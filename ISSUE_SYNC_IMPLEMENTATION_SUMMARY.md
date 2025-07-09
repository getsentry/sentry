# Issue Sync Implementation Summary

## Overview

This document summarizes the implementation of issue sync functionality for GitHub, GitLab, Bitbucket, and Bitbucket Server integrations in Sentry. The implementation follows the existing patterns used by Jira and Azure DevOps (VSTS) integrations.

## What Was Implemented

### 1. GitHub Integration (`src/sentry/integrations/github/integration.py`)

**Changes Made:**
- Added `IssueSyncIntegration` to the inheritance chain
- Added sync configuration keys:
  - `comment_key = "sync_comments"`
  - `outbound_status_key = "sync_status_forward"`
  - `inbound_status_key = "sync_status_reverse"`
  - `outbound_assignee_key = "sync_forward_assignment"`
  - `inbound_assignee_key = "sync_reverse_assignment"`

**Implemented Methods:**
- `sync_assignee_outbound()`: Syncs assignee from Sentry to GitHub issues using PATCH `/repos/{repo}/issues/{issue_number}`
- `sync_status_outbound()`: Syncs status from Sentry to GitHub issues (open/closed)
- `get_resolve_sync_action()`: Determines resolve/unresolve action from GitHub webhook data
- `get_organization_config()`: Returns configuration UI fields for sync settings

**Features Added:**
- `IntegrationFeatures.ISSUE_SYNC` added to provider features

### 2. GitLab Integration (`src/sentry/integrations/gitlab/integration.py`)

**Changes Made:**
- Added `IssueSyncIntegration` to the inheritance chain
- Added sync configuration keys (same as GitHub)

**Implemented Methods:**
- `sync_assignee_outbound()`: Syncs assignee from Sentry to GitLab issues using PUT `/projects/{project_id}/issues/{issue_iid}`
- `sync_status_outbound()`: Syncs status from Sentry to GitLab issues (close/reopen)
- `get_resolve_sync_action()`: Determines resolve/unresolve action from GitLab webhook data
- `get_organization_config()`: Returns configuration UI fields for sync settings

**Features Added:**
- `IntegrationFeatures.ISSUE_SYNC` added to provider features

### 3. Bitbucket Integration (`src/sentry/integrations/bitbucket/integration.py`)

**Changes Made:**
- Added `IssueSyncIntegration` to the inheritance chain
- Added sync configuration keys (same as GitHub)

**Implemented Methods:**
- `sync_assignee_outbound()`: Syncs assignee from Sentry to Bitbucket issues using PUT `/repositories/{repo_name}/issues/{issue_id}`
- `sync_status_outbound()`: Syncs status from Sentry to Bitbucket issues (open/closed)
- `get_resolve_sync_action()`: Determines resolve/unresolve action from Bitbucket webhook data
- `get_organization_config()`: Returns configuration UI fields for sync settings

**Features Added:**
- `IntegrationFeatures.ISSUE_SYNC` added to provider features

### 4. Bitbucket Server Integration (`src/sentry/integrations/bitbucket_server/integration.py`)

**Changes Made:**
- Added `IssueSyncIntegration` to the inheritance chain
- Added sync configuration keys (same as GitHub)

**Implemented Methods:**
- `sync_assignee_outbound()`: Syncs assignee from Sentry to Bitbucket Server issues
- `sync_status_outbound()`: Syncs status from Sentry to Bitbucket Server issues (OPEN/RESOLVED)
- `get_resolve_sync_action()`: Determines resolve/unresolve action from Bitbucket Server webhook data
- `get_organization_config()`: Returns configuration UI fields for sync settings

**Features Added:**
- `IntegrationFeatures.ISSUE_SYNC` added to provider features

## Configuration Options

All integrations now support the following configuration options in their organization settings:

1. **Sync Sentry Status to [Provider]**: When a Sentry issue changes status, change the status of the linked external issue
2. **Sync Sentry Assignment to [Provider]**: When an issue is assigned in Sentry, assign its linked external issue to the same user
3. **Sync Sentry Comments to [Provider]**: Post comments from Sentry issues to linked external issues
4. **Sync [Provider] Status to Sentry**: When an external issue is closed, resolve its linked issue in Sentry
5. **Sync [Provider] Assignment to Sentry**: When an issue is assigned externally, assign its linked Sentry issue to the same user

## Implementation Details

### Core Methods Required by IssueSyncIntegration

1. **`sync_assignee_outbound(external_issue, user, assign=True, **kwargs)`**
   - Propagates Sentry issue assignee to external issue
   - Handles both assignment and unassignment cases
   - Includes error handling and logging

2. **`sync_status_outbound(external_issue, is_resolved, project_id)`**
   - Propagates Sentry issue status to external issue
   - Handles resolve/unresolve cases
   - Includes error handling and logging

3. **`get_resolve_sync_action(data)`**
   - Analyzes webhook data to determine sync action
   - Returns `ResolveSyncAction.RESOLVE`, `ResolveSyncAction.UNRESOLVE`, or `ResolveSyncAction.NOOP`

4. **`get_organization_config()`**
   - Returns configuration UI fields for sync settings
   - Handles feature flag checks for `organizations:integrations-issue-sync`

### Configuration Keys

All integrations use consistent configuration keys:
- `sync_comments`: Boolean for comment sync
- `sync_status_forward`: Boolean for outbound status sync
- `sync_status_reverse`: Boolean for inbound status sync
- `sync_forward_assignment`: Boolean for outbound assignment sync
- `sync_reverse_assignment`: Boolean for inbound assignment sync

### API Endpoints Used

- **GitHub**: PATCH `/repos/{repo}/issues/{issue_number}`
- **GitLab**: PUT `/projects/{project_id}/issues/{issue_iid}`
- **Bitbucket**: PUT `/repositories/{repo_name}/issues/{issue_id}`
- **Bitbucket Server**: PUT `/projects/{project_key}/repos/{issue_id}`

## Next Steps

### 1. API Client Method Enhancement
The current implementation uses generic `patch()`, `put()` methods. Consider adding specific methods to each client:
- `GitHubApiClient.assign_issue()`, `GitHubApiClient.close_issue()`
- `GitLabApiClient.assign_issue()`, `GitLabApiClient.close_issue()`
- etc.

### 2. User Mapping
The current implementation uses simple username matching. In production, you should implement proper user mapping:
- GitHub: Map Sentry user emails to GitHub usernames
- GitLab: Map Sentry users to GitLab user IDs
- Bitbucket: Map Sentry users to Bitbucket usernames

### 3. Webhook Integration
To support inbound sync, you'll need to:
- Update webhook handlers to call `sync_status_inbound()` method
- Parse webhook payloads correctly in `get_resolve_sync_action()`
- Test with actual webhook data from each provider

### 4. Error Handling
Consider enhancing error handling for:
- Rate limiting
- Permission errors
- Invalid user mappings
- Network failures

### 5. Testing
Implement comprehensive tests for:
- Each sync method
- Configuration UI
- Webhook handling
- Error scenarios

## Feature Flags

The implementation respects the `organizations:integrations-issue-sync` feature flag. When disabled:
- All sync configuration options are disabled in the UI
- Users see "Your organization does not have access to this feature" message

## Backward Compatibility

The implementation maintains backward compatibility:
- Existing issue linking functionality continues to work
- No breaking changes to existing APIs
- Configuration is additive only

## Security Considerations

- All sync operations include proper authentication via existing integration credentials
- User mapping should be validated to prevent unauthorized access
- Webhook validation should be implemented for inbound sync

## Monitoring and Logging

The implementation includes logging for:
- Failed assignment operations
- Failed status sync operations
- Integration errors
- Debug information for troubleshooting

Log entries include:
- Integration ID
- User ID (when applicable)
- Issue key
- Error details
