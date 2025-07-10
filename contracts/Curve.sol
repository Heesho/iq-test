// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IEntropyConsumer } from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import { IEntropy } from "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";

interface IBerachainRewardVaultFactory {
    function createRewardVault(address _vaultToken) external returns (address);
}

interface IRewardVault {
    function getDelegateStake(address account, address delegate) external view returns (uint256);
    function getTotalDelegateStaked(address account) external view returns (uint256);
    function delegateStake(address account, uint256 amount) external;
    function delegateWithdraw(address account, uint256 amount) external;
}

interface IWBERA {
    function deposit() external payable;
}

contract VaultToken is ERC20, Ownable {

    constructor() ERC20("Bull Curve", "BULL CURVE") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

}

contract Curve is IEntropyConsumer, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant AMOUNT = 1 ether;
    uint256 public constant MIN_SCORE = 50;
    uint256 public constant MAX_SCORE = 150;
    uint256 public constant MAX_FEE_SPLIT = 50;
    uint256 public constant MIN_FEE_SPLIT = 4;
    uint256 public constant DIVISOR = 100;

    address public immutable base;
    address public immutable vaultToken;
    address public immutable rewardVault;

    address public incentives;
    address public treasury;
    address public developer;
    address public community;

    IEntropy public entropy;
    uint256 public testPrice = 0.69 ether;
    uint256 public feeSplit = 20;

    uint256 maxIndex;
    mapping(uint256 => uint256) public index_Score;
    mapping(uint256 => address) public score_Account;
    mapping(uint64 => address) public sequence_Account;

    error Curve__InvalidAccount();
    error Curve__InvalidSequence();
    error Curve__InvalidScore();
    error Curve__InvalidMaxIndex();
    error Curve__InvalidArray();
    error Curve__InvalidFeeSplit();
    error Curve__NotAuthorized();

    event Curve__ScoreAdded(address indexed account, uint256 indexed score);
    event Curve__ScoreRemoved(address indexed account, uint256 indexed score);
    event Curve__ScoreSet(uint256 indexed index, uint256 indexed score);
    event Curve__MaxIndexSet(uint256 indexed maxIndex);
    event Curve__TestRequested(uint64 indexed sequenceNumber, address indexed account);
    event Curve__Tested(address indexed account, uint256 indexed score);
    event Curve__Distribute(uint256 indexed incentivesFee, uint256 indexed treasuryFee, uint256 indexed developerFee, uint256 indexed communityFee);
    event Curve__TestPriceSet(uint256 indexed testPrice);
    event Curve__FeeSplitSet(uint256 indexed feeSplit);
    event Curve__IncentivesSet(address indexed incentives);
    event Curve__TreasurySet(address indexed treasury);
    event Curve__DeveloperSet(address indexed developer);
    event Curve__CommunitySet(address indexed community);

    constructor(
        address _base,
        address _incentives,
        address _treasury,
        address _developer,
        address _community,
        address _vaultFactory,
        address _entropy
    ) {
        base = _base;
        incentives = _incentives;
        treasury = _treasury;
        developer = _developer;
        community = _community;
        entropy = IEntropy(_entropy);
        
        vaultToken = address(new VaultToken());
        rewardVault = IBerachainRewardVaultFactory(_vaultFactory).createRewardVault(address(vaultToken));
    }

    function distribute() 
        external 
        nonReentrant
    {
        uint256 balance = address(this).balance;
        uint256 fee = balance * feeSplit / DIVISOR;
        uint256 treasuryFee = fee * 2 / 5;
        uint256 developerFee = fee * 2 / 5;
        uint256 communityFee = fee * 1 / 5;
        uint256 incentivesFee = balance - fee;
        IWBERA(base).deposit{value: balance}();

        IERC20(base).safeTransfer(treasury, treasuryFee);
        IERC20(base).safeTransfer(developer, developerFee);
        IERC20(base).safeTransfer(incentives, incentivesFee);
        IERC20(base).safeTransfer(community, communityFee);

        emit Curve__Distribute(incentivesFee, treasuryFee, developerFee, communityFee);
    }

    function test(address account, bytes32 userRandomNumber) external payable nonReentrant {
        if (account == address(0)) revert Curve__InvalidAccount();
        if (msg.value < testPrice) revert Curve__InsufficientPayment();

        if (address(entropy) != address(0)) {
            address entropyProvider = entropy.getDefaultProvider();
            uint256 fee = entropy.getFee(entropyProvider);
            if (msg.value < testPrice + fee) revert Curve__InsufficientPayment();
            uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(entropyProvider, userRandomNumber);
            sequence_Account[sequenceNumber] = account;
            emit Curve__TestRequested(sequenceNumber, account);
        } else {
            userRandomNumber = keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender));
            mockCallback(account, userRandomNumber);
            emit Curve__TestRequested(0, account);
        }

    }

    receive() external payable {}

    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        address account = sequence_Account[sequenceNumber];
        if (account == address(0)) revert Curve__InvalidSequence();

        uint256 index = uint256(randomNumber) % maxIndex;
        uint256 score = index_Score[index];
        if (score < MIN_SCORE || score > MAX_SCORE) revert Curve__InvalidScore();

        address prevAccount = score_Account[score];
        if (prevAccount != address(0)) {
            IRewardVault(rewardVault).delegateWithdraw(prevAccount, AMOUNT);
            VaultToken(vaultToken).burn(address(this), AMOUNT);
            emit Curve__ScoreRemoved(prevAccount, score);
        }

        score_Account[score] = account;
        emit Curve__ScoreAdded(account, score);

        VaultToken(vaultToken).mint(address(this), AMOUNT);
        IERC20(vaultToken).safeApprove(rewardVault, 0);
        IERC20(vaultToken).safeApprove(rewardVault, AMOUNT);
        IRewardVault(rewardVault).delegateStake(account, AMOUNT);

        delete sequence_Account[sequenceNumber];

        emit Curve__Tested(account, score);
    }

    function mockCallback(address account, bytes32 randomNumber) internal {
        uint256 index = uint256(randomNumber) % maxIndex;
        uint256 score = index_Score[index];
        if (score < MIN_SCORE || score > MAX_SCORE) revert Curve__InvalidScore();

        address prevAccount = score_Account[score];
        if (prevAccount != address(0)) {
            IRewardVault(rewardVault).delegateWithdraw(prevAccount, AMOUNT);
            VaultToken(vaultToken).burn(address(this), AMOUNT);
            emit Curve__ScoreRemoved(prevAccount, score);
        }

        score_Account[score] = account;
        emit Curve__ScoreAdded(account, score);
        
        VaultToken(vaultToken).mint(address(this), AMOUNT);
        IERC20(vaultToken).safeApprove(rewardVault, 0);
        IERC20(vaultToken).safeApprove(rewardVault, AMOUNT);
        IRewardVault(rewardVault).delegateStake(account, AMOUNT);

        emit Curve__Tested(account, score);
    }

    function setMaxIndex(uint256 _maxIndex) external onlyOwner {
        if (_maxIndex <= maxIndex) revert Curve__InvalidMaxIndex();
        maxIndex = _maxIndex;
        emit Curve__MaxIndexSet(_maxIndex);
    }

    function setScore(uint256 index, uint256 score) external onlyOwner {
        if (score < MIN_SCORE || score > MAX_SCORE) revert Curve__InvalidScore();
        index_Score[index] = score;
        emit Curve__ScoreSet(index, score);
    }

    function setScores(uint256[] memory indexes, uint256[] memory scores) external onlyOwner {
        if (indexes.length != scores.length) revert Curve__InvalidArray();
        for (uint256 i = 0; i < indexes.length; i++) {
            if (scores[i] < MIN_SCORE || scores[i] > MAX_SCORE) revert Curve__InvalidScore();
            index_Score[indexes[i]] = scores[i];
            emit Curve__ScoreSet(indexes[i], scores[i]);
        }
    }

    function setTestPrice(uint256 _testPrice) external onlyOwner {
        testPrice = _testPrice;
        emit Curve__TestPriceSet(_testPrice);
    }

    function setFeeSplit(uint256 _feeSplit) external onlyOwner {
        if (_feeSplit > MAX_FEE_SPLIT || _feeSplit < MIN_FEE_SPLIT) revert Curve__InvalidFeeSplit();
        feeSplit = _feeSplit;
        emit Curve__FeeSplitSet(_feeSplit);
    }

    function setIncentives(address _incentives) external onlyOwner {
        incentives = _incentives;
        emit Curve__IncentivesSet(_incentives);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit Curve__TreasurySet(_treasury);
    }
    
    function setDeveloper(address _developer) external {
        if (msg.sender != developer) revert Curve__NotAuthorized();
        developer = _developer;
        emit Curve__DeveloperSet(_developer);
    }

    function setCommunity(address _community) external onlyOwner {
        community = _community;
        emit Curve__CommunitySet(_community);
    }

    function balanceOf(address account) public view returns (uint256) {
        return IRewardVault(rewardVault).getDelegateStake(account, address(this));
    }

    function totalSupply() public view returns (uint256) {
        return IRewardVault(rewardVault).getTotalDelegateStaked(address(this));
    }

    function getCurve() public view returns (address[] memory) {
        address[] memory result = new address[](MAX_SCORE - MIN_SCORE);
        for (uint256 i = MIN_SCORE; i < MAX_SCORE; i++) {
            result[i - MIN_SCORE] = score_Account[i];
        }
        return result;
    }

    function getScores(uint256 start, uint256 end) public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = index_Score[i];
        }
        return result;
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

}