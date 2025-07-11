# Remove sentry:similarity_backfill_completed Option

## Overview
This PR removes the `sentry:similarity_backfill_completed` option throughout the codebase and updates the related logic to use region-level settings instead.

## Background
The `sentry:similarity_backfill_completed` option was a temporary mechanism used to track which projects have been backfilled for similarity grouping with Seer. According to the TODO comment in the code, this option was intended to be removed once all projects have been backfilled.

## Changes Made

### 1. Option Registration Removal
- Removed the option registration from `src/sentry/projectoptions/defaults.py`
- Removed the option from the `OPTION_KEYS` list in `src/sentry/models/options/project_option.py`

### 2. Business Logic Updates
- **`src/sentry/grouping/ingest/seer.py`**: Updated `_project_has_similarity_grouping_enabled()` to use `similarity.new_project_seer_grouping.enabled` instead of checking the backfill option
- **`src/sentry/seer/similarity/utils.py`**: Updated `project_is_seer_eligible()` to only check if the feature is enabled in the region
- **`src/sentry/tasks/post_process.py`**: Removed the dependency on the backfill option, now only skips for reprocessed events
- **`src/sentry/api/endpoints/team_projects.py`**: Removed the logic that sets the option for new projects
- **`src/sentry/api/endpoints/project_details.py`**: Always call seer deletion on project deletion (removed the option check)
- **`src/sentry/tasks/delete_seer_grouping_records.py`**: Removed the dependency on the backfill option
- **`src/sentry/tasks/embeddings_grouping/`**: Updated backfill scripts to remove dependencies on the option

### 3. Constants Cleanup
- Removed `PROJECT_BACKFILL_COMPLETED` constant from `src/sentry/tasks/embeddings_grouping/constants.py`

### 4. Test Updates
- Updated all test files to use `similarity.new_project_seer_grouping.enabled` option instead of the removed option
- Modified tests to use `override_options()` with the new region-level setting
- Updated test expectations to reflect the new behavior

## Key Files Modified
- `src/sentry/projectoptions/defaults.py`
- `src/sentry/models/options/project_option.py`
- `src/sentry/grouping/ingest/seer.py`
- `src/sentry/seer/similarity/utils.py`
- `src/sentry/tasks/post_process.py`
- `src/sentry/api/endpoints/team_projects.py`
- `src/sentry/api/endpoints/project_details.py`
- `src/sentry/tasks/delete_seer_grouping_records.py`
- `src/sentry/tasks/embeddings_grouping/backfill_seer_grouping_records_for_project.py`
- `src/sentry/tasks/embeddings_grouping/utils.py`
- `src/sentry/tasks/embeddings_grouping/constants.py`
- Multiple test files across the codebase

## Testing
- Updated all related test files to use the new region-level setting
- Tests now use `override_options({"similarity.new_project_seer_grouping.enabled": True/False})` to control similarity grouping behavior
- All existing functionality should continue to work as before, but now controlled by the region-level setting

## Impact
This change simplifies the similarity grouping logic by removing the per-project backfill tracking and relying on the region-level setting. The behavior should remain the same for end users, but the internal implementation is cleaner and more maintainable.
