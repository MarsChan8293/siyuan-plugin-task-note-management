#!/bin/bash

echo "====================================="
echo "MCP Force Refresh Bug Test - Setup"
echo "====================================="
echo ""

echo "Step 1: Check SiYuan server availability..."
if curl -s http://localhost:6806 > /dev/null; then
    echo "✓ SiYuan server is running at http://localhost:6806"
else
    echo "✗ SiYuan server is not running"
    echo "  Please start SiYuan with:"
    echo "  - Docker: docker run -d -p 6806:6806 -v $(pwd)/siyuan-data:/siyuan/workspace b3log/siyuan"
    echo "  - Or launch SiYuan application"
    exit 1
fi

echo ""
echo "Step 2: Install dependencies..."
npm install

echo ""
echo "Step 3: Build the plugin..."
npm run build

echo ""
echo "Step 4: Install plugin to SiYuan..."
echo "  Copy dist/ directory to: \$SIYUAN_WORKSPACE/data/plugins/siyuan-plugin-task-note-management/"
echo "  Then refresh plugin in SiYuan settings"

echo ""
echo "Step 5: Install Playwright browsers..."
npx playwright install chromium

echo ""
echo "====================================="
echo "Setup complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Ensure the plugin is loaded in SiYuan"
echo "2. Run: npm run test:mcp-bug"
echo "3. Or run integration test: npm run test:mcp-integration"
