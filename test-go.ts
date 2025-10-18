#!/usr/bin/env node
/**
 * Test script for Go Language Server (gopls)
 */

import * as path from 'path';
import { LSPClient } from './dist/lsp/client.js';
import { readDefinition } from './dist/tools/definition.js';
import { findReferences } from './dist/tools/references.js';
import { getHoverInfo } from './dist/tools/hover.js';
import { getDiagnosticsForFile } from './dist/tools/diagnostics.js';
import { createLogger, Component, setGlobalLevel, LogLevel } from './dist/logging/logger.js';

const logger = createLogger(Component.CORE);

if (process.env.LOG_LEVEL) {
  setGlobalLevel(LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO);
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

  let client: LSPClient | null = null;

  try {
    console.log('📡 Starting gopls...');
    client = new LSPClient('gopls', []);
    
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
      const def = await readDefinition(client, 'UserService');
      console.log('✅ Found UserService:');
      console.log(def.substring(0, 600) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 2: Find User struct
    console.log('🔍 TEST 2: Finding User struct');
    console.log('-'.repeat(80));
    try {
      const def = await readDefinition(client, 'User');
      console.log('✅ Found User struct:');
      console.log(def.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 3: Find function
    console.log('🔍 TEST 3: Finding CreateDefaultUser function');
    console.log('-'.repeat(80));
    try {
      const def = await readDefinition(client, 'CreateDefaultUser');
      console.log('✅ Found CreateDefaultUser:');
      console.log(def.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 4: Find references
    console.log('🔗 TEST 4: Finding references to UserService');
    console.log('-'.repeat(80));
    try {
      const refs = await findReferences(client, 'UserService');
      console.log('✅ Found references:');
      console.log(refs.substring(0, 600) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 5: Hover information
    console.log('💡 TEST 5: Getting hover information');
    console.log('-'.repeat(80));
    try {
      const hover = await getHoverInfo(client, sampleFile, 16, 10);
      console.log('✅ Hover at UserService:');
      console.log(hover.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 6: Diagnostics
    console.log('🔍 TEST 6: Getting diagnostics');
    console.log('-'.repeat(80));
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = await getDiagnosticsForFile(client, sampleFile, 3, true);
      console.log('✅ Diagnostics:');
      console.log(diagnostics.substring(0, 500) + '\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 7: Method references
    console.log('🔗 TEST 7: Finding references to AddUser method');
    console.log('-'.repeat(80));
    try {
      const refs = await findReferences(client, 'AddUser');
      console.log('✅ Found method references:');
      console.log(refs.substring(0, 500) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ Go tests completed!');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
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

