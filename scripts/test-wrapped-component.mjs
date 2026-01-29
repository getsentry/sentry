#!/usr/bin/env node
/**
 * Test script to verify wrapped/styled components are traced correctly
 */

import {execSync} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Testing wrapped component tracing...\n');

// Test 1: Button → SearchBar → Pages
console.log('Test 1: Verify Button traces through SearchBar (styled component wrapper)');
console.log('-----------------------------------------------------------------------\n');

const buttonResult = execSync(
  'node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx',
  {encoding: 'utf-8', cwd: path.resolve(__dirname, '..')}
);

const searchBarResult = execSync(
  'node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar/index.tsx',
  {encoding: 'utf-8', cwd: path.resolve(__dirname, '..')}
);

// Extract URLs from both results
const buttonUrls = new Set(
  buttonResult
    .split('\n')
    .filter(line => line.trim().startsWith('•'))
    .map(line => line.trim().replace(/^•\s+/, ''))
);

const searchBarUrls = new Set(
  searchBarResult
    .split('\n')
    .filter(line => line.trim().startsWith('•'))
    .map(line => line.trim().replace(/^•\s+/, ''))
);

// Check overlap
const commonUrls = [...searchBarUrls].filter(url => buttonUrls.has(url));

console.log(`✓ Button found in ${buttonUrls.size} URLs`);
console.log(`✓ SearchBar found in ${searchBarUrls.size} URLs`);
console.log(
  `✓ Common URLs: ${commonUrls.length} (${Math.round((commonUrls.length / searchBarUrls.size) * 100)}%)`
);

if (commonUrls.length > 0) {
  console.log('\n✅ SUCCESS: Button correctly traces through SearchBar!');
  console.log('\nExample common URLs:');
  commonUrls.slice(0, 5).forEach(url => console.log(`  • ${url}`));

  if (commonUrls.length === searchBarUrls.size) {
    console.log(
      '\n💯 Perfect match! All SearchBar URLs are included in Button URLs.'
    );
    console.log(
      'This confirms that styled(Button) components are correctly traced.'
    );
  }
} else {
  console.log('\n❌ FAIL: No common URLs found between Button and SearchBar');
  console.log('This suggests wrapped components are not being traced correctly.');
}

console.log('\n' + '='.repeat(80));
console.log('Test complete!');
