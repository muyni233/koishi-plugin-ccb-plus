import { Schema } from 'koishi';
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
    toggleCooldown: number;
    cheatList: CheatConfig[];
}
export declare const Config: Schema<CCBConfig>;
