#!/usr/bin/env node
/**
 * Manual test script to verify LSP functionality
 * Tests real LSP operations: symbol search, definitions, references, hover, etc.
 */

import * as path from 'path';
import { LSPClient } from './dist/lsp/client.js';
import { readDefinition } from './dist/tools/definition.js';
import { findReferences } from './dist/tools/references.js';
import { getHoverInfo } from './dist/tools/hover.js';
import { getDiagnosticsForFile } from './dist/tools/diagnostics.js';
import { createLogger, Component, setGlobalLevel, LogLevel } from './dist/logging/logger.js';

const logger = createLogger(Component.CORE);

// Set log level from environment or default to INFO
if (process.env.LOG_LEVEL) {
  setGlobalLevel(LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO);
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

  let client: LSPClient | null = null;

  try {
    // 1. Initialize LSP Client
    console.log('📡 Starting TypeScript Language Server...');
    client = new LSPClient('typescript-language-server', ['--stdio']);
    
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
      const userServiceDef = await readDefinition(client, 'UserService');
      console.log('✅ Found UserService definition:');
      console.log(userServiceDef.substring(0, 500) + '...\n');
    } catch (err) {
      console.log(`❌ Error finding UserService: ${err}\n`);
    }

    // 3. Test: Find interface definition
    console.log('🔍 TEST 2: Finding interface definition');
    console.log('-'.repeat(80));
    
    try {
      const userInterfaceDef = await readDefinition(client, 'User');
      console.log('✅ Found User interface:');
      console.log(userInterfaceDef.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error finding User interface: ${err}\n`);
    }

    // 4. Test: Find function definition
    console.log('🔍 TEST 3: Finding function definition');
    console.log('-'.repeat(80));
    
    try {
      const functionDef = await readDefinition(client, 'createDefaultUser');
      console.log('✅ Found createDefaultUser function:');
      console.log(functionDef.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error finding createDefaultUser: ${err}\n`);
    }

    // 5. Test: Find all references
    console.log('🔗 TEST 4: Finding all references to UserService');
    console.log('-'.repeat(80));
    
    try {
      const refs = await findReferences(client, 'UserService');
      console.log('✅ Found references:');
      console.log(refs.substring(0, 600) + '...\n');
    } catch (err) {
      console.log(`❌ Error finding references: ${err}\n`);
    }

    // 6. Test: Hover information
    console.log('💡 TEST 5: Getting hover information');
    console.log('-'.repeat(80));
    
    try {
      // Line 10 is where UserService class is defined
      const hover = await getHoverInfo(client, sampleFile, 10, 15);
      console.log('✅ Hover information at UserService:');
      console.log(hover.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error getting hover info: ${err}\n`);
    }

    // 7. Test: Get diagnostics
    console.log('🔍 TEST 6: Getting diagnostics');
    console.log('-'.repeat(80));
    
    try {
      // Wait a bit for diagnostics to be published
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const diagnostics = await getDiagnosticsForFile(client, sampleFile, 3, true);
      console.log('✅ Diagnostics for sample.ts:');
      console.log(diagnostics.substring(0, 500));
      console.log();
      
      const consumerDiagnostics = await getDiagnosticsForFile(client, consumerFile, 3, true);
      console.log('✅ Diagnostics for consumer.ts:');
      console.log(consumerDiagnostics.substring(0, 500));
      console.log();
    } catch (err) {
      console.log(`❌ Error getting diagnostics: ${err}\n`);
    }

    // 8. Test: Method references
    console.log('🔗 TEST 7: Finding references to addUser method');
    console.log('-'.repeat(80));
    
    try {
      const methodRefs = await findReferences(client, 'addUser');
      console.log('✅ Found method references:');
      console.log(methodRefs.substring(0, 500) + '...\n');
    } catch (err) {
      console.log(`❌ Error finding method references: ${err}\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
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

