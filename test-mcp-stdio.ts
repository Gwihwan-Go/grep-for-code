#!/usr/bin/env ts-node
/**
 * Test the MCP server by sending it MCP protocol messages
 * This simulates what Claude Desktop does
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: any;
}

async function testMCPServer() {
  console.log('🧪 Testing MCP Server via stdio...\n');

  // Spawn the MCP server
  const server = spawn('node', [
    'dist/index.js',
    '--workspace',
    process.cwd(),
    '--lsp',
    'typescript-language-server',
    '--',
    '--stdio'
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let requestId = 1;
  const pendingRequests = new Map<number, (response: any) => void>();

  // Read responses from server
  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    try {
      const response: MCPResponse = JSON.parse(line);
      console.log('📥 Received:', JSON.stringify(response, null, 2));
      
      if (response.id !== undefined && pendingRequests.has(response.id)) {
        const resolver = pendingRequests.get(response.id)!;
        pendingRequests.delete(response.id);
        resolver(response);
      }
    } catch (err) {
      console.log('📥 Non-JSON output:', line);
    }
  });

  server.stderr.on('data', (data) => {
    console.log('📝 Server log:', data.toString());
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });

  server.on('close', (code) => {
    console.log(`\n✅ Server exited with code ${code}`);
  });

  // Helper to send requests
  function sendRequest(method: string, params?: any): Promise<any> {
    const id = requestId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    console.log('\n📤 Sending:', JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + '\n');

    return new Promise((resolve) => {
      pendingRequests.set(id, resolve);
    });
  }

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // 1. Initialize the MCP server
    console.log('\n=== Step 1: Initialize MCP Server ===');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });

    if (initResponse.error) {
      console.error('❌ Initialize failed:', initResponse.error);
      server.kill();
      return;
    }

    console.log('✅ MCP Server initialized!');
    console.log('   Server capabilities:', JSON.stringify(initResponse.result?.capabilities, null, 2));

    // 2. List available tools
    console.log('\n=== Step 2: List Available Tools ===');
    const toolsResponse = await sendRequest('tools/list', {});

    if (toolsResponse.error) {
      console.error('❌ List tools failed:', toolsResponse.error);
      server.kill();
      return;
    }

    console.log('✅ Available tools:');
    const tools = toolsResponse.result?.tools || [];
    tools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    if (tools.length === 0) {
      console.error('❌ NO TOOLS FOUND! This is the problem.');
    }

    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (err) {
    console.error('❌ Test failed:', err);
  }

  // Shutdown
  server.kill();
  process.exit(0);
}

testMCPServer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

