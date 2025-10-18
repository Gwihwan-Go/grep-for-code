#!/usr/bin/env node
"use strict";
/**
 * Test script for Go Language Server (gopls)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const client_js_1 = require("./dist/lsp/client.js");
const definition_js_1 = require("./dist/tools/definition.js");
const references_js_1 = require("./dist/tools/references.js");
const hover_js_1 = require("./dist/tools/hover.js");
const diagnostics_js_1 = require("./dist/tools/diagnostics.js");
const logger_js_1 = require("./dist/logging/logger.js");
const logger = (0, logger_js_1.createLogger)(logger_js_1.Component.CORE);
if (process.env.LOG_LEVEL) {
    (0, logger_js_1.setGlobalLevel)(logger_js_1.LogLevel[process.env.LOG_LEVEL] || logger_js_1.LogLevel.INFO);
}
async function runGoTests() {
    const workspaceDir = path.resolve(__dirname, 'test-workspace-go');
    const sampleFile = path.join(workspaceDir, 'sample.go');
    const consumerFile = path.join(workspaceDir, 'consumer.go');
    console.log('='.repeat(80));
    console.log('Go Language Server (gopls) - Test');
    console.log('='.repeat(80));
    console.log(`Workspace: ${workspaceDir}`);
    console.log();
    let client = null;
    try {
        console.log('📡 Starting gopls...');
        client = new client_js_1.LSPClient('gopls', []);
        const initResult = await client.initialize(workspaceDir);
        console.log('✅ gopls initialized');
        console.log(`   Server: ${initResult.serverInfo?.name || 'gopls'} v${initResult.serverInfo?.version || 'unknown'}`);
        console.log();
        await client.waitForServerReady();
        console.log('📂 Opening Go files...');
        await client.openFile(sampleFile);
        await client.openFile(consumerFile);
        console.log('✅ Files opened');
        console.log('⏳ Waiting for analysis...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Analysis complete\n');
        // Test 1: Find struct type
        console.log('🔍 TEST 1: Finding UserService struct');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'UserService');
            console.log('✅ Found UserService:');
            console.log(def.substring(0, 600) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 2: Find User struct
        console.log('🔍 TEST 2: Finding User struct');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'User');
            console.log('✅ Found User struct:');
            console.log(def.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 3: Find function
        console.log('🔍 TEST 3: Finding CreateDefaultUser function');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'CreateDefaultUser');
            console.log('✅ Found CreateDefaultUser:');
            console.log(def.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 4: Find references
        console.log('🔗 TEST 4: Finding references to UserService');
        console.log('-'.repeat(80));
        try {
            const refs = await (0, references_js_1.findReferences)(client, 'UserService');
            console.log('✅ Found references:');
            console.log(refs.substring(0, 600) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 5: Hover information
        console.log('💡 TEST 5: Getting hover information');
        console.log('-'.repeat(80));
        try {
            const hover = await (0, hover_js_1.getHoverInfo)(client, sampleFile, 16, 10);
            console.log('✅ Hover at UserService:');
            console.log(hover.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 6: Diagnostics
        console.log('🔍 TEST 6: Getting diagnostics');
        console.log('-'.repeat(80));
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const diagnostics = await (0, diagnostics_js_1.getDiagnosticsForFile)(client, sampleFile, 3, true);
            console.log('✅ Diagnostics:');
            console.log(diagnostics.substring(0, 500) + '\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 7: Method references
        console.log('🔗 TEST 7: Finding references to AddUser method');
        console.log('-'.repeat(80));
        try {
            const refs = await (0, references_js_1.findReferences)(client, 'AddUser');
            console.log('✅ Found method references:');
            console.log(refs.substring(0, 500) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        console.log('='.repeat(80));
        console.log('✅ Go tests completed!');
        console.log('='.repeat(80));
    }
    catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    }
    finally {
        if (client) {
            console.log('\n🧹 Cleaning up...');
            await client.closeAllFiles();
            await client.shutdown();
            await client.exit();
            await client.close();
            console.log('✅ Cleanup complete');
        }
    }
}
runGoTests().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
