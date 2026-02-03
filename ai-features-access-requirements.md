# AI Features Access Requirements in Sentry

## Summary for Shayna's Question

**Yes, you are correct!** The options required to enable AI features like LLM issue detection on projects are:

1. **Feature Flag**: `organizations:gen-ai-features` = **True**
2. **Organization Option**: `sentry:hide_ai_features` = **False** (or not set)

## Detailed Findings

### Common Pattern Across All AI Features

All AI features in Sentry follow a consistent access control pattern:

```python
has_access = (
    features.has("organizations:gen-ai-features", organization)
    and not bool(organization.get_option("sentry:hide_ai_features"))
)
```

### Specific Feature Implementations

#### 1. LLM Issue Detection

**Location**: `src/sentry/tasks/llm_issue_detection/detection.py:248-252`

```python
has_access = features.has("organizations:gen-ai-features", organization) and not bool(
    organization.get_option("sentry:hide_ai_features")
)
if not has_access:
    return
```

#### 2. Replay AI Summary

**Location**: `src/sentry/replays/endpoints/project_replay_summary.py:112-119`

```python
def has_replay_summary_access(self, project: Project, request: Request) -> bool:
    return (
        features.has("organizations:session-replay", project.organization, actor=request.user)
        and features.has(
            "organizations:replay-ai-summaries", project.organization, actor=request.user
        )
        and has_seer_access(project.organization, actor=request.user)
    )
```

The `has_seer_access()` function (`src/sentry/seer/seer_setup.py:51-58`):

```python
def has_seer_access(
    organization: Organization, actor: User | AnonymousUser | RpcUser | None = None
) -> bool:
    return (
        features.has("organizations:gen-ai-features", organization, actor=actor)
        and not bool(organization.get_option("sentry:hide_ai_features"))
        and get_seer_org_acknowledgement(organization)
    )
```

#### 3. Trace Query Helper (Trace Explorer AI)

**Location**: `src/sentry/seer/endpoints/trace_explorer_ai_query.py:96-108`

```python
if organization.get_option("sentry:hide_ai_features", False):
    return Response(
        {"detail": "AI features are disabled for this organization."},
        status=status.HTTP_403_FORBIDDEN,
    )

if not features.has(
    "organizations:gen-ai-features", organization=organization, actor=request.user
):
    return Response(
        {"detail": "Organization does not have access to this feature"},
        status=status.HTTP_403_FORBIDDEN,
    )
```

#### 4. Issue AI Summary (Autofix Summary)

**Location**: `src/sentry/seer/autofix/issue_summary.py:520-527`

```python
if not features.has("organizations:gen-ai-features", group.organization, actor=user):
    return {"detail": "Feature flag not enabled"}, 400

if group.organization.get_option("sentry:hide_ai_features"):
    return {"detail": "AI features are disabled for this organization."}, 403

if not get_seer_org_acknowledgement(group.organization):
    return {"detail": "AI Autofix has not been acknowledged by the organization."}, 403
```

#### 5. Code Review

**Location**: `src/sentry/seer/code_review/preflight.py:87-95`

```python
def _check_legal_ai_consent(self) -> PreflightDenialReason | None:
    has_gen_ai_flag = features.has("organizations:gen-ai-features", self.organization)
    has_hidden_ai = self.organization.get_option(
        "sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT
    )

    if not has_gen_ai_flag or has_hidden_ai:
        return PreflightDenialReason.ORG_LEGAL_AI_CONSENT_NOT_GRANTED
    return None
```

#### 6. Web Vitals Issue Detection

**Location**: `src/sentry/tasks/web_vitals_issue_detection.py:344-347`

```python
if not features.has("organizations:gen-ai-features", project.organization):
    continue

if project.organization.get_option("sentry:hide_ai_features"):
    continue
```

### Additional Considerations

#### User/Org Acknowledgement (Being Phased Out)

Some features also check for `get_seer_org_acknowledgement(organization)`, which requires that the organization has acknowledged Seer usage. However, this is being phased out with the `organizations:gen-ai-consent-flow-removal` feature flag.

**Location**: `src/sentry/seer/seer_setup.py:27-37`

```python
def get_seer_org_acknowledgement(organization: Organization) -> bool:
    # The consent requirement for generative AI features is being removed
    # After GA, remove all calls to this function
    if features.has("organizations:gen-ai-consent-flow-removal", organization):
        return True

    return PromptsActivity.objects.filter(
        feature=feature_name,
        organization_id=organization.id,
        project_id=0,
    ).exists()
```

#### Issue Summary for Alerts

**Location**: `src/sentry/integrations/utils/issue_summary_for_alerts.py:25-31`

This function adds additional checks beyond the base requirements:

- `features.has("organizations:gen-ai-features", group.organization)` ✓
- `group.organization.get_option("sentry:hide_ai_features")` = False ✓
- `project.get_option("sentry:seer_scanner_automation")` = True
- `group.organization.get_option("sentry:enable_seer_enhanced_alerts", default=True)` = True
- Budget and rate limiting checks

## Conclusion

For **testing LLM issue detection** and other AI features, the minimum requirements are:

### Required:

1. **Feature flag**: `organizations:gen-ai-features` = **True**
2. **Organization option**: `sentry:hide_ai_features` = **False** (or not set)

### Optional (depending on feature):

3. **Acknowledgement**: Organization has acknowledged Seer (via PromptsActivity) - _being phased out_
4. **Feature-specific flags**: Some features require additional flags:
   - Replay AI: `organizations:session-replay` + `organizations:replay-ai-summaries`
   - Code Review: `organizations:code-review-beta` or seat-based Seer plan

## How to Verify an Organization is Eligible

To check if an organization has access to AI features, use the helper function:

```python
from sentry.seer.seer_setup import has_seer_access

has_access = has_seer_access(organization, actor=user)
```

Or with detailed error messages:

```python
from sentry.seer.seer_setup import has_seer_access_with_detail

has_access, error_detail = has_seer_access_with_detail(organization, actor=user)
if not has_access:
    print(f"Access denied: {error_detail}")
```
