import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TokenContract } from "../target/types/token_contract";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

describe("token-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenContract as Program<TokenContract>;
  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate()
  let associatedTokenAccount = undefined;
  it("Mint a token", async () => {
    // Add your test here.
    const key = anchor.AnchorProvider.env().wallet.publicKey;
    const lamports: number = await program.provider.connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );

    //GET the associated token account (ata) for a token on a public key
    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      key,
    );

    // Fires a list of instructions
    const mint_tx = new anchor.web3.Transaction().add(
      //use anchor to create an account from the key that we created
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: key,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),

      createInitializeMintInstruction(
        mintKey.publicKey, 0, key, key
      ),

      createAssociatedTokenAccountInstruction(key, associatedTokenAccount, key, mintKey.publicKey)
    );

    // sends and create the transactions
    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, [mintKey]);

    console.log(
      await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    console.log("Account: ", res);
    console.log("Mint Key: ", mintKey.publicKey.toString());
    console.log("User: ", key.toString());

    const tx = await program.methods.mintToken().accounts({
      mint: mintKey.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenAccount: associatedTokenAccount,
      payer: key
    }).rpc();

    console.log("Your transaction signature: ", tx);
    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 10);
  });
  it("Transfer token", async () => {
    // Get anchor's wallet's public key
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
    // Wallet that will receive the token 
    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    // The ATA for a token on the to wallet (but might not exist yet)
    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    // Fires a list of instructions
    const mint_tx = new anchor.web3.Transaction().add(
      // Create the ATA account that is associated with our To wallet
      createAssociatedTokenAccountInstruction(
        myWallet, toATA, toWallet.publicKey, mintKey.publicKey
      )
    );

    // Sends and create the transaction
    await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    // Executes our transfer smart contract 
    await program.methods.transferToken().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      from: associatedTokenAccount,
      signer: myWallet,
      to: toATA,
    }).rpc();

    // Get minted token amount on the ATA for our anchor wallet
    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 5);
  });
});

