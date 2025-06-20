# Enabling agents-insights Flag for ogis-sentry Organization

## Overview

The `agents-insights` feature flag is already registered in the Sentry codebase in `src/sentry/features/temporary.py` as:

```python
manager.add("organizations:agents-insights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
```

This flag uses the FLAGPOLE strategy, which means it's managed through external YAML configuration files rather than being hardcoded in the application.

## Feature Flag Configuration

The feature flag configuration has been created in `agents-insights-feature-flag.yml` to enable the `agents-insights` feature for the `ogis-sentry` organization.

### Configuration Details

- **Feature Name**: `feature.organizations:agents-insights`
- **Owner**: `agents-team`
- **Target Organization**: `ogis-sentry`
- **Rollout**: 100% for the specified organization

## How to Apply the Configuration

Based on the Slack thread context and the references to `sentry-options-automator` repository, this configuration needs to be applied through the Flagpole system:

1. **Add to sentry-options-automator repository**:
   - The YAML configuration should be added to the appropriate directory in the `sentry-options-automator` repository
   - This is referenced in PR #4236 mentioned in the Slack thread

2. **Deploy the configuration**:
   - Once the YAML file is committed to the sentry-options-automator repository
   - The Flagpole system will pick up the configuration
   - The flag will be enabled for the `ogis-sentry` organization

## Verification

After applying the configuration, you can verify that the flag is enabled by:

1. Checking the frontend UI for the agents-insights module visibility
2. Using the organization API endpoint with `include_feature_flags=1` parameter
3. Confirming that `agents-insights` appears in the organization's features list

## Related Files

- **Feature Registration**: `src/sentry/features/temporary.py:182`
- **Frontend Feature Check**: `static/app/views/insights/agentMonitoring/utils/features.tsx`
- **Module Configuration**: `static/app/views/insights/agentMonitoring/settings.ts`

## Notes

- The agents-insights feature flag is part of the newer Insights modules system
- It requires the `insights-addon-modules` feature to also be enabled
- The configuration creates a segment specifically for the `ogis-sentry` organization with 100% rollout
- A default segment with 0% rollout ensures the feature remains disabled for other organizations unless explicitly enabled
