# OutboxCategory and OutboxScope Reference

## Overview

Every outbox message has a **category** (what kind of change) and a **scope** (how it's sharded). Categories are members of the `OutboxCategory` IntEnum; scopes are members of `OutboxScope`. Each category must be registered to exactly one scope — an assertion at import time enforces this.

**Source file**: `src/sentry/hybridcloud/outbox/category.py`

## Scope-to-Category Mapping

Scope to category mappings can be found in src/sentry/hybridcloud/outbox/category.py

When selecting a scope to use, consider which other operations the target outbox depends on.

### Retired Categories and Scopes

Categories and scopes should never be deleted. If a category is to be retired, simply add an inline comment denoting it as no longer in use.

If a scope is to be retired, remove all categories from its nested definition, and denote that it's no longer in use with a comment above the list.

## Sharding Pitfalls

Understanding how shards interact with processing is critical to choosing the right scope. Getting it wrong causes subtle, hard-to-diagnose production issues.

### Head-of-Line Blocking

A shard is processed **sequentially** — every category sharing the same `(scope, shard_identifier)` sits in one queue. If a handler for one category fails, **all other categories in that shard enter backoff together**. The entire shard's `scheduled_for` is bumped, not just the failing message's.

**Example**: `ORGANIZATION_SCOPE` groups ~21 categories per org. If the `AUTH_PROVIDER_UPDATE` handler crashes for org 42, then `ORGANIZATION_MEMBER_UPDATE`, `PROJECT_UPDATE`, and all other org-42 categories are blocked until the backoff expires and the failing handler either succeeds or is fixed.

This is why high-volume or failure-prone operations sometimes get their own dedicated scope (e.g., `AUDIT_LOG_SCOPE` and `USER_IP_SCOPE` are separate from `ORGANIZATION_SCOPE` and `USER_SCOPE` respectively) — isolating them prevents their failures from blocking unrelated replication work.

### Harmful Coalescing

Outboxes with the same `(scope, shard_identifier, category, object_identifier)` are **coalesced**: only the row with the highest ID is processed, all others are deleted. This is correct for "latest state wins" replication (model sync) but destructive for event-style data where every occurrence matters.

**Bad**: Using a single category for audit log events with `object_identifier = org_id`. Multiple audit events for the same org would coalesce to just the latest one — losing audit history.

**Good**: `AUDIT_LOG_EVENT` uses its own scope and carries all data in the payload. Each event gets a unique `object_identifier` (or the coalescing is harmless because the payload is self-contained).

**Rule**: If every individual outbox message matters (not just the latest), either ensure `object_identifier` is unique per message, or use a payload-only pattern where coalescing the envelope is harmless because the signal receiver reads the payload, not the DB row.

### Hot Shards

A "hot shard" is a single `(scope, shard_identifier)` with a disproportionate number of pending outboxes. Since one shard is processed sequentially, a hot shard becomes a bottleneck.

**Causes**:

- A large org with frequent updates across many categories in `ORGANIZATION_SCOPE`
- A backfill that generates thousands of outboxes for a single shard
- A handler that's slow (network calls, large queries), causing the shard to grow faster than it drains

**Mitigation**: The system has `should_skip_shard()` kill switches for disabling specific org/user shards, and the `get_shard_depths_descending()` method helps identify hot shards. But the best fix is choosing a scope with the right granularity — see "When to Create a New Scope" below.

### Wrong Shard Key

If your model's natural grouping doesn't match the scope's shard key, you get either unnecessary contention or broken ordering guarantees.

**Example**: Putting an integration-scoped model under `ORGANIZATION_SCOPE` means all integration changes for an org share a shard with org member updates, project updates, etc. — contention with no benefit. Worse, if the model doesn't have an `organization_id` at all, `infer_identifiers()` will fail at runtime.

## When to Create a New Category

**Always create a new category** when:

- You have a new model inheriting from `ReplicatedRegionModel` or `ReplicatedControlModel`
- You have a new type of event/signal that needs outbox delivery
- The handler logic is distinct from all existing categories

**Do not reuse** an existing category for a different model or operation. Categories map 1:1 to signal receivers — reusing means both models' changes trigger the same handler.

## When to Create a New Scope vs Reuse an Existing One

**Reuse an existing scope** when:

- Your model naturally keys on the same identifier (e.g., has `organization_id` → use `ORGANIZATION_SCOPE`)
- Head-of-line blocking with the other categories in that scope is acceptable (i.e., your handler is reliable and fast)
- Coalescing with the existing shard granularity makes sense for your data

**Create a new scope** when:

- Your model's natural key doesn't match any existing scope (e.g., keyed on `integration_id` before `INTEGRATION_SCOPE` existed)
- Your handler is high-volume or failure-prone, and blocking other categories is unacceptable
- Your operation is event-style (every message matters) and you need isolation from "latest state wins" categories
- You need a different shard key granularity (e.g., per-token rather than per-org)

**Examples of good scope isolation decisions**:

- `AUDIT_LOG_SCOPE` — high-volume, every event matters, failures shouldn't block org replication
- `USER_IP_SCOPE` — very high-volume fire-and-forget, isolates from user profile replication
- `PROVISION_SCOPE` — rare but critical, isolates from general org updates to avoid head-of-line blocking during provisioning
- `API_TOKEN_SCOPE` — tokens aren't org-scoped or user-scoped in a way that fits existing scopes

**Rule of thumb**: Start with an existing scope that matches your shard key. Only create a new scope if you have a concrete concern about head-of-line blocking, harmful coalescing, or hot shards. Unnecessary scope proliferation adds operational complexity (more shards to monitor, more code paths to maintain).

## How to Pick a Scope

**Rules:**

1. If your model has an `organization_id` (or IS an Organization), use `ORGANIZATION_SCOPE`
2. If your model has a `user_id` (or IS a User) and no org context, use `USER_SCOPE`
3. If your model has an `integration_id`, use `INTEGRATION_SCOPE`
4. If your model has an `api_application_id` or is a SentryApp, use `APP_SCOPE`
5. If none of the above fit, or you have a concrete isolation concern (see above), create a new scope

The `infer_identifiers()` function in `category.py` auto-detects `shard_identifier` and `object_identifier` from model attributes based on the scope. Check its implementation to understand what field names it looks for.

## Registration Mechanics

### Adding a New Category

1. Add a new member to `OutboxCategory` with the next available integer value
2. Add the category to the appropriate `OutboxScope` member's `scope_categories()` call
3. The `scope_categories()` helper asserts no category is registered twice

```python
# In OutboxCategory enum:
MY_NEW_CATEGORY = 45  # Next available value

# In OutboxScope enum, add to the appropriate scope:
ORGANIZATION_SCOPE = scope_categories(0, {
    OutboxCategory.ORGANIZATION_UPDATE,
    # ... existing categories ...
    OutboxCategory.MY_NEW_CATEGORY,  # Add here
})
```

### Adding a New Scope

```python
# In OutboxScope enum:
MY_NEW_SCOPE = scope_categories(13, {  # Next available integer
    OutboxCategory.MY_NEW_CATEGORY,
})
```

Then update `infer_identifiers()` to handle the new scope — add a branch that maps the scope to the correct model attribute for `shard_identifier`.

### Retiring a Category

Categories that are no longer in use should:

1. Keep their enum value (never reuse integer values)
2. Add a `# no longer in use` comment
3. Stay in their `OutboxScope` registration (removing causes assertion failures for in-flight outboxes)

## Identifier Inference

`OutboxCategory.infer_identifiers(scope, model)` auto-detects identifiers by scope:

| Scope                | `shard_identifier` source                                             | `object_identifier` source |
| -------------------- | --------------------------------------------------------------------- | -------------------------- |
| `ORGANIZATION_SCOPE` | `model.organization_id` or `model.id` (if model IS Organization)      | `model.id`                 |
| `USER_SCOPE`         | `model.user_id` or `model.id` (if model IS User)                      | `model.id`                 |
| `INTEGRATION_SCOPE`  | `model.integration_id`                                                | `model.id`                 |
| `APP_SCOPE`          | `model.api_application_id` or `model.id` (if model IS ApiApplication) | `model.id`                 |
| `API_TOKEN_SCOPE`    | `model.api_token_id` or `model.id`                                    | `model.id`                 |

If inference fails (model doesn't have the expected attribute), pass `shard_identifier` explicitly to `outbox_for_update()`.
