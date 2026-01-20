import { Context, Schema } from 'koishi';
export declare const name = "ccb-plus";
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
    isLog: boolean;
    cheatList: CheatConfig[];
}
export interface CCBData {
    [groupId: string]: CCBGroupData[];
}
export interface CCBActorInfo {
    count: number;
    first: boolean;
    max: boolean;
}
export interface CCBGroupData {
    id: string;
    num: number;
    vol: number;
    ccb_by: {
        [actorId: string]: CCBActorInfo;
    };
    max: number;
}
export interface CCBLogEntry {
    group: string;
    executor: string;
    target: string;
    time: number;
    vol: string;
}
export interface CCBActionTime {
    [userId: string]: number[];
}
declare module 'koishi' {
    interface Tables {
        ccb_data: CCBData;
    }
}
export declare const Config: Schema<CCBConfig>;
export declare function apply(ctx: Context, config: CCBConfig): void;
