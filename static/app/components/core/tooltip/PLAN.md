# Tooltip Component Documentation Plan

## Component Analysis

### Core Props (from TooltipProps interface):

- `title`: React.ReactNode - The main tooltip content
- `children`: React.ReactNode - The element that triggers the tooltip
- `disabled`: boolean - Disable tooltip display entirely
- `maxWidth`: number - Max width constraint (default: 225px)
- `overlayStyle`: React.CSSProperties | SerializedStyles - Additional styling
- Inherits from `UseHoverOverlayProps` which includes positioning, hover behavior, etc.

### Key Features from Implementation:

1. **Basic tooltip**: Shows content on hover
2. **Positioning**: Supports top, bottom, left, right positions
3. **Hover behavior**: Can be made hoverable for interactive content
4. **Portal rendering**: Renders in document.body by default or custom container
5. **Context support**: Uses TooltipContext for custom container
6. **Animation**: Uses AnimatePresence for smooth transitions
7. **Accessibility**: Includes proper ARIA attributes via Overlay component

### Current Story Examples:

1. Basic tooltip with button
2. Hoverable vs non-hoverable tooltips
3. All positioning options (top, bottom, left, right)
4. forceVisible prop for demonstrations

## Documentation Structure Plan

1. **Introduction**: Basic usage and purpose
2. **Basic Example**: Simple tooltip with button
3. **Positioning**: Show different position options
4. **Hover Behavior**: Hoverable vs non-hoverable
5. **Custom Content**: Rich content examples
6. **Disabled State**: Show disabled prop
7. **Custom Styling**: maxWidth and overlayStyle examples
8. **Accessibility**: Note about screen reader support

## Examples to Include:

- Basic tooltip
- Different positions (top, bottom, left, right)
- Hoverable tooltip for interactive content
- Custom max width
- Rich content (multiple lines, formatted text)
- Disabled state
- Custom styling
