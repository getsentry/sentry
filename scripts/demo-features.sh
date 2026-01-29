#!/bin/bash
# Demo script to showcase all features of find-component-urls.mjs

echo "========================================="
echo "Component URL Finder - Feature Demo"
echo "========================================="
echo ""

echo "1️⃣  Basic Usage (no substitution)"
echo "-----------------------------------"
node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A8 "Found SearchBar"
echo ""
echo ""

echo "2️⃣  With Default Substitutions"
echo "-----------------------------------"
node scripts/find-component-urls.mjs --substitute SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A8 "Found SearchBar"
echo ""
echo ""

echo "3️⃣  Custom Org and Project"
echo "-----------------------------------"
node scripts/find-component-urls.mjs --org acme-corp --project python SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A8 "Found SearchBar"
echo ""
echo ""

echo "4️⃣  Bulk Parameter Substitution"
echo "-----------------------------------"
node scripts/find-component-urls.mjs --params "orgId=prod,projectId=backend,dashboardId=99" SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A8 "Found SearchBar"
echo ""
echo ""

echo "5️⃣  Showing Trace Paths"
echo "-----------------------------------"
node scripts/find-component-urls.mjs --trace SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A15 "Example trace"
echo ""
echo ""

echo "6️⃣  Combined: Substitute + Trace"
echo "-----------------------------------"
node scripts/find-component-urls.mjs --substitute --trace SearchBar static/app/components/searchBar/index.tsx 2>&1 | grep -A15 "Example trace"
echo ""
echo ""

echo "========================================="
echo "✅ Demo Complete!"
echo "========================================="
