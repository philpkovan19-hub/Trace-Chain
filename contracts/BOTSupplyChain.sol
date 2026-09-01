// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BOTSupplyChain
/// @notice TraceChain - a supply chain tracking DApp on BOT Chain.
/// @dev Anyone can create a product; the manufacturer and authorized handlers may advance its stage.
contract BOTSupplyChain is Ownable, ReentrancyGuard, Pausable {
    enum Stage {
        Created,
        InTransit,
        Delivered
    }

    struct Product {
        uint256 id;
        string name;
        string description;
        string origin;
        address manufacturer;
        Stage currentStage;
        uint256 createdAt;
    }

    struct Checkpoint {
        uint256 timestamp;
        address handler;
        Stage stage;
        string location;
        string notes;
    }

    uint256 public productCount;

    mapping(uint256 => Product) private products;
    mapping(uint256 => Checkpoint[]) private checkpoints;
    mapping(uint256 => mapping(address => bool)) private handlers;

    event ProductCreated(uint256 indexed id, address indexed manufacturer, string name);
    event StageUpdated(uint256 indexed id, uint8 stage, address indexed handler, string location);
    event HandlerAdded(uint256 indexed id, address indexed handler);

    constructor() Ownable(msg.sender) {}

    modifier productExists(uint256 productId) {
        require(products[productId].manufacturer != address(0), "Product does not exist");
        _;
    }

    modifier onlyManufacturer(uint256 productId) {
        require(products[productId].manufacturer == msg.sender, "Not the manufacturer");
        _;
    }

    /// @notice Create a new product, recording the initial Created checkpoint.
    function createProduct(
        string calldata name,
        string calldata description,
        string calldata origin
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(bytes(name).length > 0, "Name required");

        productCount += 1;
        uint256 newId = productCount;

        products[newId] = Product({
            id: newId,
            name: name,
            description: description,
            origin: origin,
            manufacturer: msg.sender,
            currentStage: Stage.Created,
            createdAt: block.timestamp
        });

        checkpoints[newId].push(
            Checkpoint({
                timestamp: block.timestamp,
                handler: msg.sender,
                stage: Stage.Created,
                location: origin,
                notes: "Product created"
            })
        );

        emit ProductCreated(newId, msg.sender, name);

        return newId;
    }

    /// @notice Advance a product's stage. Callable by the manufacturer or an authorized handler.
    function updateStage(
        uint256 productId,
        uint8 newStage,
        string calldata location,
        string calldata notes
    ) external whenNotPaused nonReentrant productExists(productId) {
        require(newStage <= uint8(Stage.Delivered), "Invalid stage");
        require(
            msg.sender == products[productId].manufacturer || handlers[productId][msg.sender],
            "Not authorized"
        );

        Product storage product = products[productId];
        require(newStage >= uint8(product.currentStage), "Cannot revert stage");

        product.currentStage = Stage(newStage);

        checkpoints[productId].push(
            Checkpoint({
                timestamp: block.timestamp,
                handler: msg.sender,
                stage: Stage(newStage),
                location: location,
                notes: notes
            })
        );

        emit StageUpdated(productId, newStage, msg.sender, location);
    }

    /// @notice Authorize an address to update a product's stage. Manufacturer only.
    function addHandler(uint256 productId, address handler)
        external
        productExists(productId)
        onlyManufacturer(productId)
    {
        require(handler != address(0), "Handler required");
        handlers[productId][handler] = true;
        emit HandlerAdded(productId, handler);
    }

    /// @notice Fetch a product's core details.
    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (
            uint256 id,
            string memory name,
            string memory description,
            string memory origin,
            address manufacturer,
            uint8 currentStage,
            uint256 createdAt
        )
    {
        Product storage product = products[productId];
        return (
            product.id,
            product.name,
            product.description,
            product.origin,
            product.manufacturer,
            uint8(product.currentStage),
            product.createdAt
        );
    }

    /// @notice Fetch the full checkpoint history of a product.
    function getCheckpoints(uint256 productId)
        external
        view
        productExists(productId)
        returns (Checkpoint[] memory)
    {
        return checkpoints[productId];
    }

    /// @notice Total number of products created.
    function getProductCount() external view returns (uint256) {
        return productCount;
    }

    /// @notice Whether an address is the manufacturer of, or an authorized handler for, a product.
    function isHandler(uint256 productId, address handler) external view returns (bool) {
        return handler == products[productId].manufacturer || handlers[productId][handler];
    }

    /// @notice Pause product creation and stage updates.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume product creation and stage updates.
    function unpause() external onlyOwner {
        _unpause();
    }
}
