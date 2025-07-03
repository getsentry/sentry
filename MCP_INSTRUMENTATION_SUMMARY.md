# MCP Instrumentation Implementation

## Overview

I've created a comprehensive MCP (Model Context Protocol) instrumentation page for Sentry's insights module, following the same pattern as the existing agent monitoring page. This implementation provides monitoring and observability for MCP servers, resources, and tool invocations.

## Components Created

### Main Page
- **`mcpOverviewPage.tsx`** - The main MCP instrumentation overview page
  - Follows the same structure as `agentsOverviewPage.tsx`
  - Features a 6-widget grid layout
  - Includes tabbed tables for different MCP aspects
  - Supports search filtering and date range selection

### Widgets
1. **`mcpConnectionsWidget.tsx`** - Monitors MCP server connections
   - Shows connection counts and server status
   - Displays top MCP servers by usage

2. **`mcpToolInvocationsWidget.tsx`** - Tracks MCP tool usage
   - Monitors tool invocation frequency
   - Shows performance metrics for tool calls

3. **`mcpResourceUsageWidget.tsx`** - Monitors resource access patterns
   - Tracks resource read/write operations
   - Shows most accessed resources

### Tables
1. **`mcpServersTable.tsx`** - Lists connected MCP servers
   - Server status and performance metrics
   - Connection health information

2. **`mcpResourcesTable.tsx`** - Shows MCP resources
   - Resource access patterns
   - Performance data for resource operations

3. **`mcpToolsTable.tsx`** - Displays MCP tools
   - Tool usage frequency
   - Performance metrics for tool invocations

## Widget Layout

The MCP overview page features a 6-position widget grid:

```
+------------------+------------------+------------------+
| Position 1       | Position 2       | Position 3       |
| Agents Runs      | Agents Duration  | Issues Widget    |
| Chart Widget     | Chart Widget     | (reused)         |
+------------------+------------------+------------------+
| Position 4       | Position 5       | Position 6       |
| MCP Connections  | MCP Tool         | MCP Resource     |
| Widget           | Invocations      | Usage Widget     |
+------------------+------------------+------------------+
```

## Table Tabs

The page includes a segmented control with tabs for:
- **Traces** - Reuses existing traces table
- **MCP Servers** - New table for server monitoring
- **Resources** - New table for resource monitoring
- **MCP Tools** - New table for tool monitoring

## Key Features

### Analytics Tracking
- Page view tracking: `mcp-monitoring.page-view`
- Table switch tracking: `mcp-monitoring.table-switch`
- Widget-specific referrers for performance monitoring

### Search & Filtering
- Integrated search query builder
- Date range filtering
- Environment and project filtering
- MCP-specific span operation filters

### MCP-Specific Attributes
The implementation assumes the following span attributes for MCP instrumentation:
- `mcp.server.name` - Name of the MCP server
- `mcp.tool.name` - Name of the MCP tool being invoked
- `mcp.resource.uri` - URI of the MCP resource being accessed
- Span operations: `mcp.connection`, `mcp.tool.invoke`, `mcp.resource.read`, `mcp.resource.write`

### Onboarding State
- Detects if projects have MCP monitoring enabled via `hasInsightsMcpMonitoring` flag
- Shows onboarding UI when no MCP instrumentation is detected

## Integration Points

### Referrers Added
Updated `referrers.tsx` with MCP-specific referrers:
- `MCP_CONNECTIONS_WIDGET`
- `MCP_RESOURCE_USAGE_WIDGET`
- `MCP_TOOL_INVOCATIONS_WIDGET`
- `MCP_SERVERS_TABLE`
- `MCP_RESOURCES_TABLE`
- `MCP_TOOLS_TABLE`

### Extended Table Types
Added new `MCPTableType` enum for table switching:
- `SERVERS`
- `RESOURCES`
- `TOOLS`

## Implementation Status

### Completed
✅ Main page structure and layout
✅ Widget placeholder components
✅ Table placeholder components
✅ Analytics tracking setup
✅ Referrer configuration
✅ Search and filtering integration

### Future Enhancements
- Full widget implementations with real MCP span data
- Complete table implementations with sorting and pagination
- MCP server health checks and status indicators
- Resource access permission monitoring
- Tool performance benchmarking
- Error rate monitoring for MCP operations

## Usage

To use the MCP instrumentation page:

1. Ensure your application has MCP instrumentation enabled
2. Configure span attributes for MCP operations
3. Navigate to the MCP instrumentation page
4. Use filters to analyze MCP performance data
5. Switch between different table views for detailed analysis

The page provides comprehensive monitoring for Model Context Protocol implementations, helping developers understand server performance, resource usage patterns, and tool invocation metrics.
