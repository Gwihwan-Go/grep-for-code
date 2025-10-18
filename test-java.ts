#!/usr/bin/env node
/**
 * Test script for Java Language Server (jdtls)
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

  let client: LSPClient | null = null;

  try {
    console.log('📡 Starting jdtls...');
    // Note: jdtls requires a specific command structure
    // This is a simplified version - actual setup may vary
    const jdtlsCommand = 'jdtls'; // Or full path to jdtls script
    client = new LSPClient(jdtlsCommand, []);
    
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
      const def = await readDefinition(client, 'UserService');
      console.log('✅ Found UserService:');
      console.log(def.substring(0, 600) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 2: Find User class
    console.log('🔍 TEST 2: Finding User class');
    console.log('-'.repeat(80));
    try {
      const def = await readDefinition(client, 'User');
      console.log('✅ Found User:');
      console.log(def.substring(0, 400) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 3: Find method
    console.log('🔍 TEST 3: Finding createDefaultUser method');
    console.log('-'.repeat(80));
    try {
      const def = await readDefinition(client, 'createDefaultUser');
      console.log('✅ Found createDefaultUser:');
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
      const hover = await getHoverInfo(client, serviceFile, 9, 15);
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
      const diagnostics = await getDiagnosticsForFile(client, serviceFile, 3, true);
      console.log('✅ Diagnostics:');
      console.log(diagnostics.substring(0, 500) + '\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    // Test 7: Method references
    console.log('🔗 TEST 7: Finding references to addUser method');
    console.log('-'.repeat(80));
    try {
      const refs = await findReferences(client, 'addUser');
      console.log('✅ Found method references:');
      console.log(refs.substring(0, 500) + '...\n');
    } catch (err) {
      console.log(`❌ Error: ${err}\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ Java tests completed!');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('❌ Fatal error:', err);
    console.log('\n💡 Tip: Make sure jdtls is installed and in your PATH');
    console.log('   Installation: https://github.com/eclipse/eclipse.jdt.ls');
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

runJavaTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

