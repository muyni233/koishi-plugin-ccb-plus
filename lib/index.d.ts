import { Context } from 'koishi';
import { Config, CCBConfig } from './config';
export declare const name = "ccb-plus";
export declare const inject: string[];
export { Config };
export * from './config';
export * from './model';
export declare function apply(ctx: Context, config: CCBConfig): void;
