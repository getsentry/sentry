# Issue Labels Feature - MVP Implementation

This is a frontend-only MVP implementation of the issue labels feature for Sentry, as requested in [GitHub Issue #5572](https://github.com/getsentry/sentry/issues/5572).

## Features Implemented

### 1. Label Management

- **Add Labels**: Users can add custom labels to individual issues
- **Remove Labels**: Labels can be removed from issues
- **Persistent Storage**: Labels are stored in localStorage (frontend-only implementation)
- **Unique Colors**: Each label gets a unique color for visual distinction

### 2. Label Display

- **Issue List View**: Labels are displayed below each issue in the issue list
- **Compact Display**: Labels show with a "+X more" indicator when there are many labels
- **Visual Design**: Labels use colored backgrounds with the label name

### 3. Label Filtering

- **Search Integration**: Labels can be used in search queries with `label:"labelname"` syntax
- **Filter UI**: A dedicated label filter component in the issue list filters
- **Multi-select**: Users can filter by multiple labels simultaneously

## Components Created

### Core Hook

- `useIssueLabels` - Manages label state and operations

### UI Components

- `IssueLabel` - Individual label display component
- `IssueLabelList` - List of labels with overflow handling
- `IssueLabelInput` - Input for adding new labels
- `LabelFilter` - Filter component for selecting labels

### Integration Points

- Modified `EventOrGroupExtraDetails` to display labels
- Modified `StreamGroup` to include label input
- Modified `IssueListFilters` to include label filtering

## Usage

### Adding Labels to Issues

1. Navigate to the issue list
2. Hover over an issue row to see the "Add Label" button
3. Click "Add Label" and enter the label name
4. Press Enter or click "Add" to create the label

### Filtering by Labels

1. Use the label filter dropdown in the issue list filters
2. Select one or more labels to filter by
3. The search query will automatically include `label:"labelname"` filters

### Search Query Syntax

- Filter by a single label: `label:"bug"`
- Filter by multiple labels: `label:"bug" label:"high-priority"`
- Combine with other filters: `is:unresolved label:"frontend"`

## Technical Implementation

### Data Storage

- Labels are stored in localStorage under the key `sentry_issue_labels`
- Data structure: `{ [issueId]: IssueLabel[] }`
- Each label has: `id`, `name`, and `color`

### State Management

- Uses React hooks for local state management
- Labels are reactive and update the UI immediately
- No backend integration (frontend-only MVP)

### Styling

- Uses Sentry's design system and emotion/styled
- Responsive design that works on different screen sizes
- Consistent with existing Sentry UI patterns

## Limitations (Frontend-Only MVP)

1. **No Backend Persistence**: Labels are lost when localStorage is cleared
2. **No Cross-Device Sync**: Labels are only available on the current device
3. **No Team Sharing**: Labels are user-specific
4. **No Analytics**: No tracking of label usage or effectiveness
5. **No Bulk Operations**: Can't add/remove labels from multiple issues at once

## Future Enhancements

To make this a production feature, the following would need to be implemented:

1. **Backend API**: Database schema and API endpoints for label CRUD operations
2. **Team Collaboration**: Shared labels across organization members
3. **Label Templates**: Predefined label sets for common use cases
4. **Bulk Operations**: Add/remove labels from multiple issues
5. **Label Analytics**: Usage statistics and insights
6. **Integration**: Connect with existing Sentry features like alerts and workflows

## Testing

The implementation includes a demo page at `static/app/views/issueLabels/demo.tsx` that showcases all the label functionality.

## Files Modified/Created

### New Files

- `static/app/hooks/useIssueLabels.ts`
- `static/app/components/issueLabels/issueLabel.tsx`
- `static/app/components/issueLabels/issueLabelList.tsx`
- `static/app/components/issueLabels/issueLabelInput.tsx`
- `static/app/components/issueLabels/labelFilter.tsx`
- `static/app/components/issueLabels/index.tsx`
- `static/app/views/issueLabels/demo.tsx`

### Modified Files

- `static/app/components/eventOrGroupExtraDetails.tsx`
- `static/app/components/stream/group.tsx`
- `static/app/views/issueList/filters.tsx`

## Installation

1. The components are already integrated into the existing Sentry codebase
2. No additional dependencies are required
3. Labels will be available immediately in the issue list

## Browser Compatibility

- Requires localStorage support
- Works in all modern browsers
- Gracefully degrades if localStorage is not available

## Performance Considerations

- Labels are loaded on-demand
- No performance impact on issue list rendering
- Minimal memory footprint for label storage
