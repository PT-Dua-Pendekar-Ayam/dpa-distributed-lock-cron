export declare const distributedLockConfig: (() => {
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
        keyPrefix: string;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
        keyPrefix: string;
    };
}>;
//# sourceMappingURL=distributed-lock.config.d.ts.map