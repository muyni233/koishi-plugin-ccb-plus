import { Context, Session } from 'koishi';
export declare class CcbState {
    actionTimes: Record<string, number[]>;
    banList: Record<string, number>;
    nicknameCache: Map<string, {
        name: string;
        timestamp: number;
    }>;
    private static MAX_CACHE_SIZE;
    private static CACHE_DURATION;
    private cleanupTimer;
    constructor(ctx: Context);
    private cleanup;
    getAvatar(userId: string): string;
    getUserNickname(session: Session, userId: string): Promise<string>;
    checkGroupCommand(session: Session): string | null;
    findTargetUser(session: Session, input: string): Promise<string | null>;
    validateTargetUser(session: Session, target: string): Promise<string>;
}
