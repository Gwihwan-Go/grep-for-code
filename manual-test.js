#!/usr/bin/env node
"use strict";
/**
 * Manual test script to verify LSP functionality
 * Tests real LSP operations: symbol search, definitions, references, hover, etc.
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
// Set log level from environment or default to INFO
if (process.env.LOG_LEVEL) {
    (0, logger_js_1.setGlobalLevel)(logger_js_1.LogLevel[process.env.LOG_LEVEL] || logger_js_1.LogLevel.INFO);
}
async function runTests() {
    const workspaceDir = path.resolve(__dirname, 'test-workspace');
    const sampleFile = path.join(workspaceDir, 'sample.ts');
    const consumerFile = path.join(workspaceDir, 'consumer.ts');
    console.log('='.repeat(80));
    console.log('MCP Language Server - Manual Test');
    console.log('='.repeat(80));
    console.log(`Workspace: ${workspaceDir}`);
    console.log();
    let client = null;
    try {
        // 1. Initialize LSP Client
        console.log('📡 Starting TypeScript Language Server...');
        client = new client_js_1.LSPClient('typescript-language-server', ['--stdio']);
        const initResult = await client.initialize(workspaceDir);
        console.log('✅ LSP Server initialized');
        console.log(`   Server: ${initResult.serverInfo?.name || 'unknown'} v${initResult.serverInfo?.version || 'unknown'}`);
        console.log();
        await client.waitForServerReady();
        console.log('✅ Server ready');
        console.log();
        // Open files first so TypeScript language server can analyze them
        console.log('📂 Opening files for analysis...');
        await client.openFile(sampleFile);
        await client.openFile(consumerFile);
        console.log('✅ Files opened');
        // Wait for TypeScript to analyze the files
        console.log('⏳ Waiting for analysis to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Analysis complete');
        console.log();
        // 2. Test: Find workspace symbols
        console.log('🔍 TEST 1: Finding workspace symbols');
        console.log('-'.repeat(80));
        try {
            const userServiceDef = await (0, definition_js_1.readDefinition)(client, 'UserService');
            console.log('✅ Found UserService definition:');
            console.log(userServiceDef.substring(0, 500) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error finding UserService: ${err}\n`);
        }
        // 3. Test: Find interface definition
        console.log('🔍 TEST 2: Finding interface definition');
        console.log('-'.repeat(80));
        try {
            const userInterfaceDef = await (0, definition_js_1.readDefinition)(client, 'User');
            console.log('✅ Found User interface:');
            console.log(userInterfaceDef.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error finding User interface: ${err}\n`);
        }
        // 4. Test: Find function definition
        console.log('🔍 TEST 3: Finding function definition');
        console.log('-'.repeat(80));
        try {
            const functionDef = await (0, definition_js_1.readDefinition)(client, 'createDefaultUser');
            console.log('✅ Found createDefaultUser function:');
            console.log(functionDef.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error finding createDefaultUser: ${err}\n`);
        }
        // 5. Test: Find all references
        console.log('🔗 TEST 4: Finding all references to UserService');
        console.log('-'.repeat(80));
        try {
            const refs = await (0, references_js_1.findReferences)(client, 'UserService');
            console.log('✅ Found references:');
            console.log(refs.substring(0, 600) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error finding references: ${err}\n`);
        }
        // 6. Test: Hover information
        console.log('💡 TEST 5: Getting hover information');
        console.log('-'.repeat(80));
        try {
            // Line 10 is where UserService class is defined
            const hover = await (0, hover_js_1.getHoverInfo)(client, sampleFile, 10, 15);
            console.log('✅ Hover information at UserService:');
            console.log(hover.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error getting hover info: ${err}\n`);
        }
        // 7. Test: Get diagnostics
        console.log('🔍 TEST 6: Getting diagnostics');
        console.log('-'.repeat(80));
        try {
            // Wait a bit for diagnostics to be published
            await new Promise(resolve => setTimeout(resolve, 1000));
            const diagnostics = await (0, diagnostics_js_1.getDiagnosticsForFile)(client, sampleFile, 3, true);
            console.log('✅ Diagnostics for sample.ts:');
            console.log(diagnostics.substring(0, 500));
            console.log();
            const consumerDiagnostics = await (0, diagnostics_js_1.getDiagnosticsForFile)(client, consumerFile, 3, true);
            console.log('✅ Diagnostics for consumer.ts:');
            console.log(consumerDiagnostics.substring(0, 500));
            console.log();
        }
        catch (err) {
            console.log(`❌ Error getting diagnostics: ${err}\n`);
        }
        // 8. Test: Method references
        console.log('🔗 TEST 7: Finding references to addUser method');
        console.log('-'.repeat(80));
        try {
            const methodRefs = await (0, references_js_1.findReferences)(client, 'addUser');
            console.log('✅ Found method references:');
            console.log(methodRefs.substring(0, 500) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error finding method references: ${err}\n`);
        }
        console.log('='.repeat(80));
        console.log('✅ All tests completed!');
        console.log('='.repeat(80));
    }
    catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    }
    finally {
        // Cleanup
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
// Run the tests
runTests().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
