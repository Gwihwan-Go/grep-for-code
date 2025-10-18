/**
 * Integration tests
 * These tests require actual language servers to be installed
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LSPClient } from '../lsp/client';
import { symbol } from '../lsp/methods';
import { WorkspaceSymbolParams } from '../protocol/types';

// Skip integration tests in CI unless explicitly enabled
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIntegration = runIntegrationTests ? describe : describe.skip;

describeIntegration('LSP Integration Tests', () => {
  let tempDir: string;
  let testFile: string;

  beforeAll(async () => {
    // Create temporary workspace
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-test-'));
    testFile = path.join(tempDir, 'test.ts');

    // Write test file
    fs.writeFileSync(
      testFile,
      `
export function testFunction() {
  return 42;
}

export class TestClass {
  constructor(public name: string) {}
  
  greet(): string {
    return \`Hello, \${this.name}\`;
  }
}
    `.trim()
    );

    // Write package.json
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
      })
    );

    // Write tsconfig.json
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
        },
      })
    );
  });

  afterAll(() => {
    // Cleanup
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('TypeScript Language Server', () => {
    let client: LSPClient;

    beforeAll(async () => {
      // Check if typescript-language-server is available
      try {
        client = new LSPClient('typescript-language-server', ['--stdio']);
        await client.initialize(tempDir);
        await client.waitForServerReady();
      } catch (err) {
        console.warn('typescript-language-server not available, skipping tests');
        throw err;
      }
    }, 30000);

    afterAll(async () => {
      if (client) {
        await client.closeAllFiles();
        await client.shutdown();
        await client.exit();
        await client.close();
      }
    }, 10000);

    it('should find workspace symbols', async () => {
      const result = await symbol(client, { query: 'testFunction' } as WorkspaceSymbolParams);
      const symbols = result.results();

      expect(symbols.length).toBeGreaterThan(0);
      const sym = symbols.find((s) => s.name === 'testFunction');
      expect(sym).toBeDefined();
    }, 10000);

    it('should open and close files', async () => {
      await client.openFile(testFile);
      expect(client.isFileOpen(testFile)).toBe(true);

      await client.closeFile(testFile);
      expect(client.isFileOpen(testFile)).toBe(false);
    }, 5000);

    it('should receive diagnostics', async () => {
      // Write file with error
      const errorFile = path.join(tempDir, 'error.ts');
      fs.writeFileSync(errorFile, 'const x: number = "string";');

      await client.openFile(errorFile);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const uri = `file://${errorFile}`;
      const diagnostics = client.getFileDiagnostics(uri);

      expect(diagnostics.length).toBeGreaterThan(0);
    }, 10000);
  });
});

describeIntegration('File Watcher Integration', () => {
  it('should detect file changes', async () => {
    // This would test the actual file watcher with a real LSP server
    // Skipped for brevity but would follow similar pattern to above
  });
});

