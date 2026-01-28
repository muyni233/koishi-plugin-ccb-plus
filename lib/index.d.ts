import { Context, Schema } from 'koishi';
export declare const name = "ccb-plus";
export declare const inject: string[];
export interface CheatConfig {
    userId: string;
    ywWindow: number;
    ywThreshold: number;
    ywProbability: number;
    critProb: number;
    ywBanDuration: number;
}
export interface CCBConfig {
    ywWindow: number;
    ywThreshold: number;
    ywBanDuration: number;
    ywProbability: number;
    whiteList: string[];
    selfCcb: boolean;
    critProb: number;
    cheatList: CheatConfig[];
}
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
}
declare module 'koishi' {
    interface Tables {
        ccb_record: CCBRecord;
        ccb_setting: CCBUserSetting;
    }
}
export declare const Config: Schema<CCBConfig>;
export declare function apply(ctx: Context, config: CCBConfig): void;
