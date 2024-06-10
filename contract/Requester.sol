// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "./rrp/interfaces/IAirnodeRrpV0.sol";

contract MockedRequester {
    address internal _airnodeRrp;
    address internal _airnode;
    address internal _sponsorWallet;
    bytes32 internal _endpointIdUint256;

    event Requested(bytes32 requestId);

    constructor() {}

    function setSettings(
        address airnodeRrp,
        address airnode,
        address sponsorWallet,
        bytes32 endpointIdUint256
    ) external {
        _airnodeRrp = airnodeRrp;
        _airnode = airnode;
        _sponsorWallet = sponsorWallet;
        _endpointIdUint256 = endpointIdUint256;

        IAirnodeRrpV0(_airnodeRrp)
            .setSponsorshipStatus(address(this), true);
    }

    ///
    /// Request
    ///

    struct Request {
        uint256 fromId;
        uint256 toId;
        uint256 timestamp;
    }

    mapping(bytes32 => Request) private _expectedRequests;

    bytes private constant _PARAMS = hex"31730000000000000000000000000000000000000000000000000000000000005f6d696e436f6e6669726d6174696f6e730000000000000000000000000000003100000000000000000000000000000000000000000000000000000000000000";

    function requestUint256(uint256 tokenIdCount, bytes4 selector) external {
        bytes32 requestId = IAirnodeRrpV0(
            _airnodeRrp
        ).makeFullRequest(
            _airnode,
            _endpointIdUint256,
            address(this),
            _sponsorWallet,
            address(this),
            selector,
            _PARAMS
        );

        _expectedRequests[requestId] = Request(0, tokenIdCount, block.timestamp);
        emit Requested(requestId);
    }

    ///
    /// Response
    ///

    struct Response {
        uint256 rawSeed;
        uint256 timestamp;
    }

    mapping(bytes32 => Response) private _requestToResponse;
    uint256 private _totalProbability;

    function fulfillUint256(bytes32 requestId, bytes calldata data) external {
        // validate request
        Request memory seedRequest = _expectedRequests[requestId];

        // decode seed
        uint256 rawSeed = abi.decode(data, (uint256));

        // set request's response
        _requestToResponse[requestId] = Response(rawSeed, seedRequest.timestamp);

        // iterate over token ids
        uint256 change = 0;
        for (uint256 i = seedRequest.fromId; i < seedRequest.toId; i++) {
            change += (rawSeed ^ i) % type(uint32).max;
        }
        _totalProbability += change;

        delete _expectedRequests[requestId];
    }

    function fulfillUint256Empty(bytes32, bytes calldata) external {
        // do nothing
    }
}