# Component URL Finder

A CLI tool to trace component usage and find all URLs where a component is rendered in the Sentry application.

## Purpose

This tool solves the discoverability problem for developers who want to:
- Find all pages/routes where a specific component is used
- Understand the impact scope of component changes
- Navigate from component code to live examples in the app
- Generate test coverage targets for component modifications

## How It Works

The tool performs three main operations:

1. **Import Graph Construction**: Scans all `.tsx` and `.ts` files in `static/app/` and builds a reverse dependency graph showing which files import each component.

2. **Route Mapping**: Parses `routes.tsx` to extract all route definitions and maps components to their URL patterns, including handling:
   - Nested route hierarchies
   - Organization path prefixes (`withOrgPath`)
   - Dynamic route parameters (`:orgId`, `:projectId`, etc.)
   - Lazy-loaded components via `make(() => import(...))`

3. **Usage Tracing**: Given a component file, traces through the import graph using BFS to find all page-level components that directly or indirectly import it, then maps those to URLs.

## Usage

```bash
node scripts/find-component-urls.mjs [options] <componentName> <filePath>
```

### Arguments

- `componentName`: The name of the component (used for display purposes)
- `filePath`: Path to the component file, relative to repository root

### Options

- `--verbose, -v`: Show detailed tracing information
- `--trace`: Show example trace paths from component to URLs
- `--substitute, -s`: Substitute URL parameters with default values
- `--org <name>`: Set organization name (default: `sentry`)
- `--project <name>`: Set project name (default: `javascript`)
- `--params <key=val,...>`: Set custom parameter substitutions

### Examples

**Basic usage:**
```bash
node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx
```

**With parameter substitution (default values):**
```bash
node scripts/find-component-urls.mjs --substitute SearchBar static/app/components/searchBar/index.tsx

# Shows URLs like:
#   /organizations/sentry/issues/
#   /organizations/sentry/dashboard/1/
```

**Custom organization and project:**
```bash
node scripts/find-component-urls.mjs --org acme-corp --project python SearchBar static/app/components/searchBar/index.tsx

# Shows URLs like:
#   /organizations/acme-corp/issues/
#   /organizations/acme-corp/projects/python/
```

**Bulk parameter substitution:**
```bash
node scripts/find-component-urls.mjs --params "orgId=my-org,projectId=react,dashboardId=42" SearchBar static/app/components/searchBar/index.tsx

# Shows URLs like:
#   /organizations/my-org/dashboard/42/
#   /projects/react/
```

**Show trace paths:**
```bash
node scripts/find-component-urls.mjs --trace SearchBar static/app/components/searchBar/index.tsx

# Shows component → page → URL traces
```

**Combine options:**
```bash
node scripts/find-component-urls.mjs --substitute --trace --org production SearchBar static/app/components/searchBar/index.tsx
```

## Parameter Substitution

The tool can substitute URL parameters with actual values to generate clickable URLs for your environment.

### Default Substitutions

When using `--substitute` or `--org`/`--project`, the following defaults are applied:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `orgId` | `sentry` | Organization slug |
| `projectId` | `javascript` | Project slug |
| `groupId` | `JAVASCRIPT-1` | Issue/group ID |
| `dashboardId` | `1` | Dashboard ID |
| `teamId` | `frontend` | Team slug |
| `artifactId` | `abc123` | Build artifact ID |
| `headArtifactId` | `abc123` | Head build artifact ID |
| `baseArtifactId` | `def456` | Base build artifact ID |
| `eventId` | `a1b2c3d4e5f6` | Event ID |
| `replaySlug` | `replay-abc123` | Replay session ID |
| `integrationSlug` | `github` | Integration slug |
| `release` | `1.0.0` | Release version |
| `id` | `1` | Generic ID |

### Most Common Parameters

Based on analysis of the codebase, these are the most frequently used URL parameters:

1. `:orgId` (31 routes) - Organization identifier
2. `:projectId` (11 routes) - Project identifier
3. `:id` (5 routes) - Generic identifier
4. `:teamId` (4 routes) - Team identifier
5. `:dashboardId` (4 routes) - Dashboard identifier

### Customizing Substitutions

You can override defaults in three ways:

**1. Using `--org` and `--project` flags:**
```bash
node scripts/find-component-urls.mjs --org my-company --project backend Button ...
```

**2. Using `--params` for bulk customization:**
```bash
node scripts/find-component-urls.mjs --params "orgId=prod,projectId=api,dashboardId=123" Button ...
```

**3. Combining both (params override org/project):**
```bash
node scripts/find-component-urls.mjs --org dev --params "dashboardId=42,teamId=backend" Button ...
```

## Output

The tool outputs:
- Progress indicators while building the import graph (~6000 files)
- **Parameter substitutions** (if enabled) showing which values are being used
- Number of nodes in the import graph
- Number of route mappings found
- Number of files traced through
- Number of page components that use the target component
- **Sorted list of URLs** where the component appears (with substitutions if enabled)
- **Total count** of unique URLs

### Example Output

**Without substitution:**
```
🔍 Finding URLs for component: SearchBar
📄 Source file: static/app/components/searchBar/index.tsx

Building import graph... (this may take a minute)
Processed 5947/5947 files...
✓ Import graph built with 5600 nodes
Parsing routes.tsx...
✓ Found 237 route mappings

Tracing component: static/app/components/searchBar/index.tsx
✓ Traced through 4748 files
✓ Found 160 page components

✅ Found SearchBar in the following URLs:

  • /organizations/:orgId/dashboard/:dashboardId/
  • /organizations/:orgId/issues/
  • /organizations/:orgId/performance/
  • ...

📊 Total URLs: 139
```

**With substitution:**
```
🔍 Finding URLs for component: SearchBar
📄 Source file: static/app/components/searchBar/index.tsx

🔄 Parameter substitutions enabled:
   :orgId → sentry
   :projectId → javascript
   :groupId → JAVASCRIPT-1
   :dashboardId → 1
   :teamId → frontend
   ... and 8 more

Building import graph... (this may take a minute)
Processed 5947/5947 files...
✓ Import graph built with 5591 nodes
Parsing routes.tsx...
✓ Found 237 route mappings

Tracing component: static/app/components/searchBar/index.tsx
✓ Traced through 4748 files
✓ Found 160 page components

✅ Found SearchBar in the following URLs:

  • /organizations/sentry/dashboard/1/
  • /organizations/sentry/issues/
  • /organizations/sentry/performance/
  • ...

📊 Total URLs: 139
```

## Performance

- **First run**: ~60-90 seconds (builds import graph from scratch)
- **Subsequent runs**: Same time (no persistent caching yet)
- **Memory usage**: ~500MB for large codebases
- **Files scanned**: ~6000 TypeScript/TSX files

## Limitations

### Current Limitations

1. **Route Context**: The tool shows URL patterns but cannot determine which routes are conditional (feature-flagged, permissions-based, etc.)

2. **Dynamic Imports**: Some dynamic imports may not be traced if they use computed strings or are loaded through non-standard mechanisms

3. **Component Wrapping**: Higher-order components and render props may not always be traced correctly through the graph

4. **No Caching**: The import graph is rebuilt on every run. Future improvement could add persistent caching.

### Known Issues

- **Partial URL Paths**: Some URLs may show relative paths if they couldn't be resolved to full patterns
- **Organization Prefix**: Not all URLs automatically include the `/organizations/:orgId/` prefix - only those with `withOrgPath: true`

## Technical Details

### Dependencies

- `@babel/parser`: Parse TypeScript/TSX files into AST
- `@babel/traverse`: Traverse AST to extract imports
- `glob`: Find all TypeScript files in the codebase

All dependencies are already included in `package.json` as transitive dependencies.

### Module Resolution

The tool understands Sentry's TypeScript path aliases:
- `sentry/*` → `static/app/*`
- `@sentry/scraps/*` → `static/app/components/core/*`
- Relative imports: `./component`, `../utils`

### Import Graph Structure

```
Map {
  '/path/to/component.tsx' => [
    '/path/to/consumer1.tsx',
    '/path/to/consumer2.tsx',
    ...
  ]
}
```

### Route Map Structure

```
Map {
  'sentry/views/issueDetails/groupDetails' => [
    '/organizations/:orgId/issues/:groupId/',
    ...
  ]
}
```

## Future Improvements

### Potential Enhancements

1. **Persistent Caching**: Cache the import graph to disk to speed up subsequent runs
2. **Incremental Updates**: Only re-scan changed files since last run
3. **Visual Output**: Generate a visual graph or HTML report showing the component usage tree
4. **Screenshot Integration**: Link to actual screenshots of pages (if available)
5. **Live URLs**: Generate clickable URLs for development environment
6. **Usage Statistics**: Show how frequently each URL is visited (if analytics data available)
7. **Change Impact Analysis**: Compare import graphs across branches to show impact of changes
8. **Component Hierarchy**: Show the full component tree from page → intermediate components → target component

### Integration Ideas

- **VSCode Extension**: Right-click a component → "Find URLs" → Show results in sidebar
- **GitHub Action**: Comment on PRs with components changed and their URL impacts
- **Developer Portal**: Web UI to browse component usage across the entire app
- **Testing Integration**: Auto-generate test cases for affected URLs

## Troubleshooting

### "File not found" error
Make sure the file path is relative to the repository root:
```bash
# ✅ Correct
node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx

# ❌ Wrong
node scripts/find-component-urls.mjs Button app/components/core/button/button.tsx
```

### "No URLs found"
The component might be:
- A utility/helper that isn't rendered in any pages
- Only used in non-routed components (modals, tooltips, etc.)
- A new component that hasn't been imported anywhere yet

### Script runs slowly
This is expected on first run. The script scans ~6000 files. Consider:
- Running on a machine with SSD storage
- Closing other memory-intensive applications
- Using the script output to document component usage rather than running repeatedly

## Contributing

To improve the script:
1. Enhance route parsing to handle more edge cases in `routes.tsx`
2. Add support for additional path aliases or import patterns
3. Implement persistent caching for the import graph
4. Add filtering options (e.g., only show routes matching a pattern)

## See Also

- `/static/app/router/routes.tsx` - Route definitions
- `/static/app/components/core/inspector.tsx` - Runtime component inspector (Cmd+I)
- `/rspack.config.ts` - Build configuration with `swc-plugin-component-annotate`
