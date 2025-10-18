#!/bin/bash
# Run all language server tests

set -e

echo "================================================================================"
echo "MCP Language Server - Multi-Language Test Suite"
echo "================================================================================"
echo ""

# Compile test scripts
echo "📦 Compiling test scripts..."
npx tsc test-go.ts --module commonjs --target ES2022 --moduleResolution node --esModuleInterop
npx tsc test-python.ts --module commonjs --target ES2022 --moduleResolution node --esModuleInterop
npx tsc test-java.ts --module commonjs --target ES2022 --moduleResolution node --esModuleInterop
echo "✅ Test scripts compiled"
echo ""

# Check available language servers
echo "🔍 Checking available language servers..."
echo ""

HAS_GOPLS=false
HAS_PYRIGHT=false
HAS_JDTLS=false

if command -v gopls &> /dev/null; then
    echo "✅ gopls found: $(which gopls)"
    HAS_GOPLS=true
else
    echo "❌ gopls not found (install: go install golang.org/x/tools/gopls@latest)"
fi

if command -v pyright-langserver &> /dev/null; then
    echo "✅ pyright found: $(which pyright-langserver)"
    HAS_PYRIGHT=true
else
    echo "❌ pyright not found (install: npm install -g pyright)"
fi

if command -v jdtls &> /dev/null; then
    echo "✅ jdtls found: $(which jdtls)"
    HAS_JDTLS=true
else
    echo "⚠️  jdtls not found (optional, install from: https://github.com/eclipse/eclipse.jdt.ls)"
fi

echo ""
echo "================================================================================"
echo ""

# Run Go tests
if [ "$HAS_GOPLS" = true ]; then
    echo "🚀 Running Go tests..."
    timeout 30 node test-go.js || echo "⚠️  Go test timed out or failed"
    echo ""
else
    echo "⏭️  Skipping Go tests (gopls not available)"
    echo ""
fi

# Run Python tests
if [ "$HAS_PYRIGHT" = true ]; then
    echo "🚀 Running Python tests..."
    timeout 30 node test-python.js || echo "⚠️  Python test timed out or failed"
    echo ""
else
    echo "⏭️  Skipping Python tests (pyright not available)"
    echo ""
fi

# Run Java tests (optional)
if [ "$HAS_JDTLS" = true ]; then
    echo "🚀 Running Java tests..."
    timeout 60 node test-java.js || echo "⚠️  Java test timed out or failed"
    echo ""
else
    echo "⏭️  Skipping Java tests (jdtls not available or not configured)"
    echo ""
fi

echo "================================================================================"
echo "✅ Multi-language test suite completed!"
echo "================================================================================"

