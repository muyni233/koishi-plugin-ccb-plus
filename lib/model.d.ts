import { Context } from 'koishi';
export interface CCBRecord {
    groupId: string;
    userId: string;
    num: number;
    vol: number;
    max: number;
    ccb_by: {
        [actorId: string]: {
            count: number;
            first: boolean;
            max: boolean;
        };
    };
}
export interface CCBUserSetting {
    userId: string;
    optOut: boolean;
    lastToggleTime: number;
    overrides: Record<string, boolean>;
}
declare module 'koishi' {
    interface Tables {
        ccb_record: CCBRecord;
        ccb_setting: CCBUserSetting;
    }
}
export declare function applyDatabase(ctx: Context): void;
