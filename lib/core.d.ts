import { Context, Session } from 'koishi';
export declare function createNewCCBRecord(ctx: Context, session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, crit: boolean, pic: string): Promise<string>;
export declare function updateCCBRecord(ctx: Context, session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, crit: boolean, pic: string): Promise<string>;
