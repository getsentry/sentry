# Component URL Finder - Quick Reference

## Common Commands

### Basic Usage
```bash
# Find URLs for a component
node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx
```

### Get Clickable URLs (Most Useful)
```bash
# Default: orgId=sentry, projectId=javascript
node scripts/find-component-urls.mjs --substitute SearchBar static/app/components/searchBar/index.tsx

# Copy output URLs directly to browser:
#   http://localhost:8000/organizations/sentry/dashboard/1/
#   http://localhost:8000/organizations/sentry/issues/
```

### Custom Organization/Project
```bash
# For testing in specific org/project
node scripts/find-component-urls.mjs --org your-org --project your-project Button static/app/components/core/button/button.tsx

# Example output:
#   /organizations/your-org/projects/your-project/
```

### See How Component is Used
```bash
# Show trace paths: Component → Consumer → Page → URL
node scripts/find-component-urls.mjs --trace SearchBar static/app/components/searchBar/index.tsx

# Output shows:
#   /organizations/:orgId/dashboard/:dashboardId/
#     ↳ searchBar/index.tsx
#       ↳ views/dashboards/manage/index.tsx
```

### Multiple Custom Parameters
```bash
# Override multiple parameters at once
node scripts/find-component-urls.mjs \
  --params "orgId=prod,projectId=backend,dashboardId=42,teamId=api" \
  Button static/app/components/core/button/button.tsx
```

### Combined (Most Powerful)
```bash
# Get clickable URLs with trace paths
node scripts/find-component-urls.mjs \
  --substitute \
  --trace \
  --org my-org \
  SearchBar static/app/components/searchBar/index.tsx
```

## Common Scenarios

### "Where is this component used?"
```bash
node scripts/find-component-urls.mjs ComponentName path/to/component.tsx
```

### "Give me URLs I can click to test this component"
```bash
node scripts/find-component-urls.mjs --substitute ComponentName path/to/component.tsx
```

### "How does this component reach the page?"
```bash
node scripts/find-component-urls.mjs --trace ComponentName path/to/component.tsx
```

### "I need URLs for my dev environment"
```bash
# If your dev uses org "dev-local" and project "test-app"
node scripts/find-component-urls.mjs \
  --org dev-local \
  --project test-app \
  ComponentName path/to/component.tsx
```

### "I want to test in production org"
```bash
node scripts/find-component-urls.mjs \
  --org sentry \
  --project sentry \
  ComponentName path/to/component.tsx
```

## Default Parameter Values

When using `--substitute`, these defaults are used:

| Parameter | Value | Used For |
|-----------|-------|----------|
| `orgId` | `sentry` | Organization routes |
| `projectId` | `javascript` | Project routes |
| `groupId` | `JAVASCRIPT-1` | Issue detail pages |
| `dashboardId` | `1` | Dashboard pages |
| `teamId` | `frontend` | Team settings |
| `artifactId` | `abc123` | Build artifacts |
| `eventId` | `a1b2c3d4e5f6` | Event details |
| `replaySlug` | `replay-abc123` | Session replays |

## Output Interpretation

### URL Format
- `/organizations/:orgId/...` → Full parameterized path
- `/organizations/sentry/...` → Substituted with actual values (when using `--substitute`)

### What the numbers mean
- **Import graph nodes**: ~5600 files scanned
- **Route mappings**: ~237 component-to-URL mappings found
- **Traced through**: How many files were checked for imports
- **Page components**: How many pages use this component
- **Total URLs**: Unique routes where component appears

### When you see 0 URLs
This means:
- Component is not used in any routed pages (yet)
- Component may be used only in modals, tooltips, or other non-routed UI
- Component is a utility/helper that doesn't render directly

## Tips & Tricks

### For Core Components (Button, Text, etc.)
Expect 100+ URLs since they're used everywhere:
```bash
node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx
# → Shows ~139 URLs
```

### For Feature Components
Expect 10-50 URLs for components used in specific features:
```bash
node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar/index.tsx
# → Shows ~139 URLs (heavily used)
```

### For Page Components
Expect 1-5 URLs for components that are pages themselves:
```bash
node scripts/find-component-urls.mjs GroupDetails static/app/views/issueDetails/groupDetails.tsx
# → Shows specific issue detail URLs
```

### Performance
- First run: ~60-90 seconds (builds import graph)
- Scanning: ~6000 TypeScript files
- Memory: ~500MB

### Verify Styled Components Work
```bash
# Button is used by SearchBarTrailingButton (styled(Button))
# Both should show overlapping URLs:
node scripts/find-component-urls.mjs Button static/app/components/core/button/button.tsx
node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar/index.tsx
```

## Real-World Examples

### Finding where to test a new feature
```bash
# You added a new prop to Button
# Find all pages where it's used to test:
node scripts/find-component-urls.mjs --substitute Button static/app/components/core/button/button.tsx

# Pick URLs from output, visit in browser:
# http://localhost:8000/organizations/sentry/dashboard/1/
```

### Impact analysis before refactoring
```bash
# You want to change SearchBar API
# See all pages that will be affected:
node scripts/find-component-urls.mjs SearchBar static/app/components/searchBar/index.tsx

# Output shows 139 URLs → high impact change
```

### Documenting component usage
```bash
# Add URLs to component documentation:
node scripts/find-component-urls.mjs --substitute ComponentName path/to/component.tsx > urls.txt

# Include in PR or docs
```

### Creating test plans
```bash
# Get all URLs for QA to test:
node scripts/find-component-urls.mjs \
  --substitute \
  --org staging \
  --project test \
  ComponentName path/to/component.tsx
```
