import { Account, AccountPosition } from "../../../types";
import { ZERO_BI } from "../../../common/config/constants";

export async function getOrCreateAccountPosition(accountAddress: string, pmAddress: string): Promise<AccountPosition> {
    const entityId = `${accountAddress}-${pmAddress}`;
    let entity = await AccountPosition.get(entityId);
    if (!entity) {
        entity = AccountPosition.create({
            id: entityId,
            accountId: accountAddress,
            pairManagerId: pmAddress,
            shares: ZERO_BI
        });
        await entity.save();
    }
    return entity;
}

export async function getOrCreateAccount(accountAddress: string): Promise<Account> {
    let entity = await Account.get(accountAddress);
    if (!entity) {
        entity = Account.create({
            id: accountAddress
        });
        await entity.save();
    }
    return entity;
}