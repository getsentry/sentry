# AlertLink Component Documentation Plan

## Component Analysis

### AlertLink Props

- Three distinct prop types (discriminated union):
  1. **ExternalAlertLinkProps**: `href` + `openInNewTab` for external links
  2. **InternalAlertLinkProps**: `to` for internal routing
  3. **ManualAlertLinkProps**: `onClick` for custom click handlers

### Shared Props (from Alert)

- `type`: info (default), warning, error, success
- `system`: boolean flag for system alerts
- `children`: alert content
- `trailingItems`: custom trailing content (defaults to right chevron)

### Key Features

- Wraps Alert component in clickable link
- Automatically adds underline decoration matching alert type colors
- Supports external links, internal routing, and manual click handlers
- Includes Container component for margin management
- Has hover states that change underline color

## Documentation Structure

Following button/index.mdx format:

1. **Frontmatter**: title, description, source, resources
2. **Basic Usage**: Simple example with each link type
3. **Alert Types**: Different alert priorities (info, warning, error, success)
4. **Link Types**: External, Internal, Manual click handlers
5. **Trailing Items**: Custom trailing content
6. **Container**: Margin management for multiple AlertLinks
7. **Accessibility**: Screen reader considerations

## Examples to Include

- Basic external link
- Internal routing
- Custom click handler
- Different alert types
- Custom trailing items
- Container usage for multiple links
- Accessibility examples

## Notes

- Component has TODOs about validation and proper link handling
- Manual onClick currently uses Link with empty "to" prop (potential issue)
- Duplicate styles between ExternalLink and Link variants
- Default trailing item is right chevron
- Underline color transitions on hover
