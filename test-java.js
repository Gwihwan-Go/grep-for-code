#!/usr/bin/env node
"use strict";
/**
 * Test script for Java Language Server (jdtls)
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
async function runJavaTests() {
    const workspaceDir = path.resolve(__dirname, 'test-workspace-java');
    const userFile = path.join(workspaceDir, 'src/main/java/com/example/User.java');
    const serviceFile = path.join(workspaceDir, 'src/main/java/com/example/UserService.java');
    const managerFile = path.join(workspaceDir, 'src/main/java/com/example/UserManager.java');
    console.log('='.repeat(80));
    console.log('Java Language Server (jdtls) - Test');
    console.log('='.repeat(80));
    console.log(`Workspace: ${workspaceDir}`);
    console.log();
    console.log('⚠️  Note: jdtls may take longer to initialize (10-30 seconds)');
    console.log();
    let client = null;
    try {
        console.log('📡 Starting jdtls...');
        // Note: jdtls requires a specific command structure
        // This is a simplified version - actual setup may vary
        const jdtlsCommand = 'jdtls'; // Or full path to jdtls script
        client = new client_js_1.LSPClient(jdtlsCommand, []);
        const initResult = await client.initialize(workspaceDir);
        console.log('✅ jdtls initialized');
        console.log(`   Server: ${initResult.serverInfo?.name || 'jdtls'} v${initResult.serverInfo?.version || 'unknown'}`);
        console.log();
        await client.waitForServerReady();
        console.log('📂 Opening Java files...');
        await client.openFile(userFile);
        await client.openFile(serviceFile);
        await client.openFile(managerFile);
        console.log('✅ Files opened');
        console.log('⏳ Waiting for analysis (this may take a while for Java)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('✅ Analysis complete\n');
        // Test 1: Find class
        console.log('🔍 TEST 1: Finding UserService class');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'UserService');
            console.log('✅ Found UserService:');
            console.log(def.substring(0, 600) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 2: Find User class
        console.log('🔍 TEST 2: Finding User class');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'User');
            console.log('✅ Found User:');
            console.log(def.substring(0, 400) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 3: Find method
        console.log('🔍 TEST 3: Finding createDefaultUser method');
        console.log('-'.repeat(80));
        try {
            const def = await (0, definition_js_1.readDefinition)(client, 'createDefaultUser');
            console.log('✅ Found createDefaultUser:');
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
            const hover = await (0, hover_js_1.getHoverInfo)(client, serviceFile, 9, 15);
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
            const diagnostics = await (0, diagnostics_js_1.getDiagnosticsForFile)(client, serviceFile, 3, true);
            console.log('✅ Diagnostics:');
            console.log(diagnostics.substring(0, 500) + '\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        // Test 7: Method references
        console.log('🔗 TEST 7: Finding references to addUser method');
        console.log('-'.repeat(80));
        try {
            const refs = await (0, references_js_1.findReferences)(client, 'addUser');
            console.log('✅ Found method references:');
            console.log(refs.substring(0, 500) + '...\n');
        }
        catch (err) {
            console.log(`❌ Error: ${err}\n`);
        }
        console.log('='.repeat(80));
        console.log('✅ Java tests completed!');
        console.log('='.repeat(80));
    }
    catch (err) {
        console.error('❌ Fatal error:', err);
        console.log('\n💡 Tip: Make sure jdtls is installed and in your PATH');
        console.log('   Installation: https://github.com/eclipse/eclipse.jdt.ls');
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
runJavaTests().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
