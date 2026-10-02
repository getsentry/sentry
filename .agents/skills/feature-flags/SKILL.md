---
name: feature-flags
description: Gate a Sentry feature behind a FlagPole feature flag. Use when adding a feature flag, registering a flag in temporary.py, checking a flag from Python or the frontend, enabling a flag in tests, or asking where FlagPole rollout config lives. Trigger on "add a feature flag", "gate this behind a flag", "register a flag", "features.has", "api_expose", "OrganizationFeature", "ProjectFeature", "FlagPole".
---

# Feature Flags (FlagPole)

New features should be gated behind a feature flag.

1. **Register** the flag in `src/sentry/features/temporary.py`:

   ```python
   manager.add("organizations:my-feature", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
   ```

   Use `api_expose=True` if the frontend needs to check the flag. Use `ProjectFeature` and a `projects:` prefix for project-scoped flags.

2. **Python check**:

   ```python
   if features.has("organizations:my-feature", organization, actor=user):
   ```

3. **Frontend check** (requires `api_expose=True`):

   ```typescript
   organization.features.includes('my-feature');
   ```

4. **Tests**:

   ```python
   with self.feature("organizations:my-feature"):
       ...
   ```

5. **Rollout**: FlagPole YAML config lives in the `sentry-options-automator` repo, not here.

6. **Removal**: once the rollout is finished, the flag comes out in a fixed three-PR order — see the `remove-option-or-flag` skill.

See https://develop.sentry.dev/feature-flags/ for full docs.
