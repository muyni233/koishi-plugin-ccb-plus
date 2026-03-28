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
    defaultOptOut: boolean;
    resetAllUsers?: 'none' | 'on' | 'off' | 'clear';
}
export declare const Config: Schema<CCBConfig>;
