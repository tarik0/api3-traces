import { ethers } from "hardhat";
import {deriveSponsorWalletAddress} from "@api3/airnode-admin";

///
/// Deploys the mocked airnode requester
/// - for testing purposes
///

const TESTNET_SETTINGS = {
    AirnodeRRP: "0x2ab9f26E18B64848cd349582ca3B55c2d06f507d",
    Airnode: "0xFf64A860cd8e3ad409274B9d276e1938DBE445BE",
    Endpoint: "0xb2813814d32461cc2939bf5dbc1500f21a37f686492eef4caee7f92bea5a7c30",
    XPub: "xpub6CUNge723kogt1CNAXyitcYDQX77tpKNmqV2ws9yofHyYNvRCP7DW81KBtc1MsVoV2XqzYhUgbojSH62PNhzZfakzRhV6pqPVgAcqboCF9n",
    InitialSponsorBalance: ethers.parseEther("0.005")
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await ethers.provider.getNetwork().then((network) => network.chainId);
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Chain ID:", chainId);
    console.log("Deploying MockedRequester...");

    // deploy requester
    const _requester = await ethers.getContractFactory("MockedRequester");
    const requester = await _requester.deploy();
    await requester.waitForDeployment();
    console.log("MockedRequester deployed to:", await requester.getAddress());

    // find the sponsor wallet
    const settings = TESTNET_SETTINGS
    const sponsorWallet = deriveSponsorWalletAddress(settings.XPub, settings.Airnode, await requester.getAddress());
    console.log("Sponsor Wallet:", sponsorWallet);

    // set balance for the sponsor wallet to max int
    await ethers.provider.send("hardhat_setBalance", [sponsorWallet, "0x80000000000000000000000000000000"]);

    // initialize the requester
    console.log("Initializing requester...");
    await requester.setSettings(settings.AirnodeRRP, settings.Airnode, sponsorWallet, settings.Endpoint)
        .then((tx) => tx.wait(1));

    // transfer initial sponsor balance
    await deployer.sendTransaction({
        to: sponsorWallet,
        value: settings.InitialSponsorBalance,
    }).then((tx) => tx.wait(1));
    console.log("Initial Sponsor Balance:", ethers.formatEther(settings.InitialSponsorBalance), "ETH");
    console.log("Initial sponsor balance transferred to:", sponsorWallet);

    // request data
    let ticketId = 25_000;
    console.log(`Requesting seed (normal) for ${ticketId} tokens...`)
    let receipt = await requester.requestUint256(ticketId, requester.interface.getFunction("fulfillUint256").selector)
        .then((tx) => tx.wait(1));
    console.log("Request receipt:", receipt!.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});