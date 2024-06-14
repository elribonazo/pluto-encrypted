
import typescript from "rollup-plugin-typescript2";
import cleanup from "rollup-plugin-cleanup";
import ignore from "rollup-plugin-ignore";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";

const externals = [
    "dexie",
    "leveldown",
    "rxjs",
    "dexie-encrypted",
    "rxdb/plugins/storage-dexie",
    "rxdb/plugins/encryption-crypto-js",
    "rxdb",
    "rxdb/plugins/migration",
    "rxdb/plugins/query-builder",
    "uuid",
    "rxdb/plugins/json-dump",
    "classic-level",
    "@atala/prism-wallet-sdk",
    "@pluto-encrypted/shared",
    "level",
    "pull-stream",
    "pull-level",
    "@noble/hashes/sha256",
    "@noble/ciphers/chacha",
    "@noble/ciphers/webcrypto/utils",
    "@pluto-encrypted/encryption",
    "vitest",
    "rxjs/operators",
    "@faker-js/faker",
    "async-test-util",
    "crypto-js"
];

export default function CreateConfig(buildPath, plugins = [], extraInputs = []) {
    const allPlugins = [
        ...plugins,
        nodeResolve({
            preferBuiltins: true,
        }),
        ignore(externals),
        json(),
        typescript({
            useTsconfigDeclarationDir: true,
            tsconfigOverride: {
                compilerOptions: {
                    emitDeclarationOnly: false,
                },
            },
        }),
        commonjs({ transformMixedEsModules: true }),
        cleanup({
            comments: ["all"],
            compactComments: false
        }),
    ]
    return [
        {
            input: [`src/index.ts`, ...extraInputs],
            output: {
                sourcemap: false,
                dir: buildPath ? `build/${buildPath}` : `build/cjs`,
                format: "cjs",
                entryFileNames: "[name].cjs"
            },
            plugins: allPlugins,
            external: externals,
            treeshake: false,

        },
        {
            input: [`src/index.ts`, ...extraInputs],
            output: {
                sourcemap: false,
                dir: buildPath ? `build/${buildPath}` : `build/esm`,
                format: "es",
                entryFileNames: "[name].mjs"
            },
            plugins: allPlugins,
            external: externals,
            treeshake: false

        }
    ];
}
