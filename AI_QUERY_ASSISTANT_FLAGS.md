# AI Query Assistant - Feature Flags and Conditions

This document outlines all the flags and conditions required for the AI Query Assistant to be visible in the UI.

## Primary Feature Flags

### 1. `organizations:gen-ai-features` (Required)
- **Type**: Organization feature flag (Flagpole)
- **Location**: `src/sentry/features/temporary.py`
- **Description**: Master feature flag for all Gen AI features
- **API Exposed**: Yes
- **Impact**: Without this flag, no AI features will work

### 2. Gen AI Consent (Required)
- **Organization Option**: `sentry:gen_ai_consent_v2024_11_14`
- **Type**: Boolean organization option
- **Default**: Defined in `DATA_CONSENT_DEFAULT`
- **Serialized As**: `genAIConsent` (frontend)
- **Location**: 
  - Backend: `src/sentry/api/serializers/models/organization.py`
  - Checked in: `src/sentry/seer/seer_setup.py`
- **Description**: User must have consented to Gen AI data usage
- **Note**: This is why there might be a delay - the org option needs to be set to `True`

### 3. Hide AI Features (Must be False/Not Set)
- **Organization Option**: `sentry:hide_ai_features`
- **Type**: Boolean organization option
- **Default**: `False`
- **Serialized As**: `hideAiFeatures` (frontend)
- **Description**: Allows orgs to explicitly disable AI features
- **Impact**: If set to `True`, all AI features are hidden

## Feature-Specific Flags

### For Trace Explorer AI Query Assistant

**Required Conditions (Frontend):**
```typescript
const areAiFeaturesAllowed =
  !organization.hideAiFeatures && 
  organization.features.includes('gen-ai-features');
```

**Backend Endpoints:**
- `/organizations/{org}/trace-explorer-ai/setup/` - Setup endpoint
- `/organizations/{org}/trace-explorer-ai/query/` - Query endpoint

**Additional Checks in Backend:**
- `organizations:gen-ai-features` flag must be enabled
- `sentry:hide_ai_features` must NOT be set to `True`
- User must be authenticated

### For Issue List AI Query Assistant

**Required Conditions (Frontend):**
```typescript
const areAiFeaturesAllowed =
  !organization.hideAiFeatures &&
  organization.features.includes('gen-ai-features') &&
  organization.features.includes('gen-ai-search-agent-translate');
```

**Additional Flag:**
- `organizations:gen-ai-search-agent-translate` (for polling/translate variant)

### For Seer Explorer (Advanced AI Features)

**Required Conditions:**
1. All base Gen AI conditions (above)
2. `organizations:seer-explorer` feature flag
3. Organization must have **open team membership** enabled:
   - `organization.flags.allow_joinleave` must be `True`
   - Location: `src/sentry/seer/explorer/client_utils.py:58`
   - Error message if not enabled: _"Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."_

**Additional Feature Flags:**
- `organizations:seer-explorer-index` - For indexing functionality
- `organizations:seer-explorer-streaming` - For streaming responses

## Consent UI Flags

### `organizations:gen-ai-consent`
- **Type**: Organization feature flag
- **Location**: `src/sentry/features/temporary.py`
- **Description**: Enables the Gen AI consent UI
- **Impact**: Controls whether consent prompt is shown

### `organizations:gen-ai-consent-flow-removal`
- **Type**: Organization feature flag
- **Description**: Removes the consent flow requirement
- **Impact**: When enabled, consent flow is bypassed

## System Options (Killswitches)

### Seer Explorer Index Options
- `seer.explorer_index.enable` - Master enable/disable for indexing
- `seer.explorer_index.killswitch.enable` - Emergency killswitch
- `seer.explorer-index.rollout` - Gradual rollout control

## Why Delays Might Occur

Based on the Slack question about delays after enabling Gen AI consent:

1. **Organization Option Propagation**: The `sentry:gen_ai_consent_v2024_11_14` organization option needs to be set to `True` and serialized to the frontend as `genAIConsent`

2. **Feature Flag Propagation**: Flagpole feature flags may have slight propagation delays

3. **Cache Invalidation**: Organization serialization is cached, so changes might not be immediately visible

4. **Missing Setup Call**: The `/trace-explorer-ai/setup/` endpoint needs to be called when the page loads to initialize Seer's cache

## Checking Feature Availability

### Backend Check
```python
from sentry import features
from sentry.seer.seer_setup import has_seer_access_with_detail

# Basic check
has_access = features.has("organizations:gen-ai-features", organization, actor=user)
hide_ai = organization.get_option("sentry:hide_ai_features")
consent = organization.get_option("sentry:gen_ai_consent_v2024_11_14")

# Detailed check with error message
has_access, error = has_seer_access_with_detail(organization, user)
```

### Frontend Check
```typescript
const organization = useOrganization();

const hasAiFeatures = 
  !organization.hideAiFeatures &&
  organization.features.includes('gen-ai-features') &&
  organization.genAIConsent;
```

## Summary Checklist

For AI Query Assistant to be visible, you need:

- ✅ `organizations:gen-ai-features` flag enabled
- ✅ `sentry:gen_ai_consent_v2024_11_14` org option set to `True`
- ✅ `sentry:hide_ai_features` org option NOT set to `True` (or not set at all)
- ✅ User authenticated
- ✅ Organization data serialized and cached properly

For advanced Seer Explorer features, additionally need:
- ✅ `organizations:seer-explorer` flag enabled
- ✅ Organization has `allow_joinleave` flag enabled

## Related Files

- Feature flags: `src/sentry/features/temporary.py`
- Seer access checks: `src/sentry/seer/seer_setup.py`
- Seer Explorer checks: `src/sentry/seer/explorer/client_utils.py`
- Org serialization: `src/sentry/api/serializers/models/organization.py`
- Frontend conditions: `static/app/views/explore/spans/spansTabSearchSection.tsx`
- Frontend conditions: `static/app/views/issueList/issueSearch.tsx`
