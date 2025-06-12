# Startups Program Frontend Implementation

## Overview
This document outlines the frontend implementation of the configurable startups program feature. The admin interface allows admins to grant customers access to configurable startups programs.

## Configuration System

### Program Configuration Structure
Programs are defined in Sentry's configuration with the following structure:

```javascript
// Configuration expected from ConfigStore.get('startupsPrograms')
{
  'ycombinator_current': {
    name: 'YCombinator (Current)',
    type: 'ycombinator',
    creditAmount: 50001,  // $50,001
  },
  'general_startups': {
    name: 'General Startups Program',
    type: 'default',
    creditAmount: 5000,   // $5,000
  },
}
```

### Program Configuration Fields
- **name**: Display name shown in the admin interface
- **type**: Program type identifier (for backend processing)
- **creditAmount**: Amount of credit in USD to grant to the customer

## Frontend Implementation

### 1. StartupsAction Component (`static/gsAdmin/components/startupsAction.tsx`)
- Modal component that dynamically loads available programs from configuration
- Uses `ConfigStore.get('startupsPrograms')` to fetch program configurations
- Displays program choices with formatted credit amounts
- Real-time display of selected program benefits
- Sends `programId` and `notes` to backend

**Component Features:**
- Dynamic program loading from configuration
- Currency formatting for credit amounts
- Program selection with live preview
- Optional notes field for admin documentation
- Form validation

### 2. Customer Details Page Integration (`static/gsAdmin/views/customerDetails.tsx`)
- Added "Grant Startups Program Access" action to the customer actions menu
- Located next to "Convert to Sponsored" action for logical grouping
- Requires billing admin permissions
- Disabled for partner accounts

**Integration Details:**
- Uses existing action pattern similar to `SponsorshipAction`
- Opens modal confirmation dialog
- Handles success/error states

## Data Flow

1. **Configuration Loading**: Component loads programs from `ConfigStore.get('startupsPrograms')`
2. **Program Selection**: Admin selects program from dropdown populated with configured programs
3. **Preview Display**: Component shows formatted credit amount and program name
4. **Form Submission**: Sends `programId` and `notes` to backend endpoint
5. **Backend Processing**: Backend handles program lookup, credit granting, and notifications

## Configuration Examples

### Production Configuration
```javascript
{
  'ycombinator_w25': {
    name: 'YCombinator (Winter 2025)',
    type: 'ycombinator',
    creditAmount: 50001,
  },
  'ycombinator_s25': {
    name: 'YCombinator (Summer 2025)',
    type: 'ycombinator',
    creditAmount: 50001,
  },
  'general_startups': {
    name: 'General Startups Program',
    type: 'default',
    creditAmount: 5000,
  },
  'techstars': {
    name: 'Techstars Program',
    type: 'default',
    creditAmount: 10000,
  },
}
```

### Development Configuration
```javascript
{
  'test_program': {
    name: 'Test Startups Program',
    type: 'default',
    creditAmount: 100,  // Small amount for testing
  },
}
```

## Component API

### Props
- `subscription`: Customer subscription object
- Standard `AdminConfirmRenderProps` from confirmation modal

### Callback Data
When the form is submitted, the component calls `onConfirm` with:
```javascript
{
  startupsProgram: true,
  programId: string,     // ID of selected program
  notes: string,         // Optional admin notes
}
```

## Frontend Testing

### Test Cases
1. **Configuration Loading**: Test with different program configurations
2. **Dynamic Display**: Verify program choices populate correctly
3. **Credit Formatting**: Test credit amount formatting for various values
4. **Program Selection**: Test program selection and description updates
5. **Form Validation**: Test required field validation
6. **Empty Configuration**: Test graceful handling of empty program configuration

### Manual Testing
1. Navigate to customer details page in admin
2. Click "Grant Startups Program Access" action
3. Verify modal shows configured programs
4. Test program selection and credit amount display
5. Test form submission with and without notes

## Benefits of Configurable Approach

1. **Flexibility**: Add/remove programs without code changes
2. **Credit Management**: Adjust credit amounts via configuration
3. **Program Names**: Update display names for seasons/cohorts
4. **Environment-Specific**: Different configurations for different environments
5. **No Hardcoding**: All program data comes from configuration

## Files Modified/Created

### Frontend Files
- ✅ `static/gsAdmin/components/startupsAction.tsx` - Configurable startups program component
- ✅ `static/gsAdmin/views/customerDetails.tsx` - Added startups program action

### Documentation
- ✅ This frontend implementation document
