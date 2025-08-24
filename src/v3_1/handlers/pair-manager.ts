import { EthereumLog } from "@subql/types-ethereum";
import { PairManager } from "../../types";
import { ZERO_ADDRESS, ZERO_BI } from "../../common/config/constants";
import { processZeroBurn } from "../../common/handlers/hype-registry";
import {
  getOrCreateAccount,
  getOrCreateAccountPosition,
} from "../helpers/entities/account";
import { updateAmountsWithCall } from "../helpers/entities/pair-manager";

export async function handleDeposit(log: EthereumLog): Promise<void> {
  const pm = await PairManager.get(log.address);
  if (!pm || !pm.active) {
    return;
  }
  const shares = BigInt(log.args!.shares.toString());
  pm.totalSupply = pm.totalSupply + shares;
  await pm.save();

  const depositor = log.args!.to as string;
  await getOrCreateAccount(depositor);
  const accountPosition = await getOrCreateAccountPosition(depositor, log.address);
  accountPosition.shares = accountPosition.shares + shares;
  await accountPosition.save();
}

export async function handleWithdraw(log: EthereumLog): Promise<void> {
  const pm = await PairManager.get(log.address);
  if (!pm || !pm.active) {
    return;
  }
  const shares = BigInt(log.args!.shares.toString());
  pm.totalSupply = pm.totalSupply - shares;
  await pm.save();

  const withdrawer = log.args!.to as string;
  await getOrCreateAccount(withdrawer);
  const accountPosition = await getOrCreateAccountPosition(withdrawer, log.address);
  accountPosition.shares = accountPosition.shares - shares;
  await accountPosition.save();
}

export async function handleTransfer(log: EthereumLog): Promise<void> {
  const from = log.args!.from as string;
  const to = log.args!.to as string;
  const value = BigInt(log.args!.value.toString());
  
  if (from === ZERO_ADDRESS || to === ZERO_ADDRESS) {
    // Ignore deposit and withdraw events that are already taken care of in the respective handlers
    return;
  }

  await getOrCreateAccount(to);
  const fromPosition = await getOrCreateAccountPosition(from, log.address);
  fromPosition.shares = fromPosition.shares - value;
  await fromPosition.save();

  const toPosition = await getOrCreateAccountPosition(to, log.address);
  toPosition.shares = toPosition.shares + value;
  await toPosition.save();
}

export async function handleZeroBurn(log: EthereumLog): Promise<void> {
  logger.warn(`[handleZeroBurn] Processing ZeroBurn event for ${log.address} at block ${log.block.number}`);
  
  // Update latest amounts
  const fees0 = BigInt(log.args!.fees0.toString());
  const fees1 = BigInt(log.args!.fees1.toString());
  logger.warn(`[handleZeroBurn] Fees - fees0: ${fees0}, fees1: ${fees1}`);
  
  if (fees0 === ZERO_BI && fees1 === ZERO_BI) {
    logger.warn(`[handleZeroBurn] Skipping zero burn ${log.transactionHash}-${log.logIndex}: zero amounts`);
    return;
  }

  logger.warn(`[handleZeroBurn] Calling updateAmountsWithCall for ${log.address}`);
  const pm = await updateAmountsWithCall(log.address, log.block);
  
  if (!pm) {
    logger.warn(`[handleZeroBurn] updateAmountsWithCall returned undefined for ${log.address}`);
    return;
  }
  
  if (!pm.active) {
    logger.warn(`[handleZeroBurn] PairManager ${log.address} is not active, skipping`);
    return;
  }
  
  logger.warn(`[handleZeroBurn] PairManager updated successfully, proceeding with processZeroBurn`)

  await processZeroBurn(
    log.address,
    fees0,
    fees1,
    log.block
  );
}

export async function handleSetFee(log: EthereumLog): Promise<void> {
  const pm = await PairManager.get(log.address);
  if (!pm || !pm.active) {
    return;
  }
  pm.fee = Number(log.args!.newFee);
  await pm.save();
}
