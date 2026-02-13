#!/usr/bin/env node

/**
 * MCP Sync Test Result Analyzer
 * Analyzes test results and generates comprehensive report
 */

import fs from 'fs';
import path from 'path';

function analyzeTestResults() {
  const resultsFile = path.join(new URL('.', import.meta.url).pathname, '..', 'test-results', 'results.json');
  
  if (!fs.existsSync(resultsFile)) {
    console.log('No test results found. Run tests first.');
    return;
  }

  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  
  console.log('=== MCP Sync Test Results Analysis ===\n');
  
  // Test summary
  console.log('Test Summary:');
  console.log(`Total tests: ${results.stats.expected}`);
  console.log(`Passed: ${results.stats.expected - results.stats.unexpected - results.stats.skipped}`);
  console.log(`Failed: ${results.stats.unexpected}`);
  console.log(`Skipped: ${results.stats.skipped}`);
  console.log('');

  // Collect all tests
  const allTests = [];
  function collectTests(suites) {
    suites.forEach(suite => {
      if (suite.specs) {
        suite.specs.forEach(spec => {
          spec.tests.forEach(test => {
            allTests.push({
              title: spec.title,
              status: test.results[0].status,
              errors: test.results[0].errors
            });
          });
        });
      }
      if (suite.suites) {
        collectTests(suite.suites);
      }
    });
  }
  
  collectTests(results.suites);

  // Detailed results
  console.log('Detailed Results:');
  allTests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.title}`);
    console.log(`   Status: ${test.status}`);
    if (test.errors && test.errors.length > 0) {
      console.log(`   Error: ${test.errors[0].message}`);
    }
    console.log('');
  });

  // Generate HTML report
  generateHtmlReport(results, allTests);
}

function generateHtmlReport(results, allTests) {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Sync Test Results</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .summary {
      background-color: #f0f0f0;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .test-result {
      border: 1px solid #ddd;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 5px;
    }
    .passed {
      border-left: 4px solid #4CAF50;
    }
    .failed {
      border-left: 4px solid #f44336;
    }
    .skipped {
      border-left: 4px solid #ff9800;
    }
    .error {
      background-color: #ffebee;
      padding: 10px;
      margin-top: 10px;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>MCP Multi-Client Sync Test Results</h1>
    
    <div class="summary">
      <h2>Test Summary</h2>
      <p>Total tests: ${results.stats.expected}</p>
      <p>Passed: ${results.stats.expected - results.stats.unexpected - results.stats.skipped}</p>
      <p>Failed: ${results.stats.unexpected}</p>
      <p>Skipped: ${results.stats.skipped}</p>
    </div>

    <h2>Detailed Results</h2>
    ${allTests.map((test, index) => `
    <div class="test-result ${test.status}">
      <h3>${index + 1}. ${test.title}</h3>
      <p>Status: ${test.status}</p>
      ${test.errors && test.errors.length > 0 ? `<div class="error">${test.errors[0].message}</div>` : ''}
    </div>
    `).join('')}
  </div>
</body>
</html>
  `;

  const outputPath = path.join(new URL('.', import.meta.url).pathname, '..', 'test-results', 'report.html');
  fs.writeFileSync(outputPath, htmlContent);
  console.log(`HTML report generated at: ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTestResults();
}

export { analyzeTestResults, generateHtmlReport };