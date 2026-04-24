---
name: django-models
description: Design Django ORM models for Sentry following architectural conventions for silos, replication, relocation, and foreign keys. Use when adding a new Django model, designing a model for a feature, deciding where data should live, picking a foreign key type, or refactoring an existing model's silo placement. Trigger on "add a Django model", "create a model", "design a model for X", "new database table", "store this data in the DB", "I need to track Y", "model for [feature]". Not for Pydantic models, dataclasses, ML models, or Protobuf — this is specifically for Django ORM models in the Sentry codebase.
---

# Sentry Model Conventions

This skill captures the _architectural_ decisions that go into a Sentry model. It does not cover Django syntax, import order, or migration generation — for those:

- Migrations: invoke the `generate-migration` skill after the model is designed.
- Outbox replication plumbing (signal receivers, payload shapes, deletion handlers): invoke the `hybrid-cloud-outboxes` skill.
- Hybrid cloud RPCs: invoke the `hybrid-cloud-rpc` skill.

## The four decisions that define a Sentry model

Before writing any fields, decide all four. They are coupled — getting one wrong forces a follow-up migration to fix the others.

### 1. Which silo does this data live in?

Cell silo (`@cell_silo_model`) is the default. Use control silo (`@control_silo_model`) only when the data is shared across organizations or has to be strongly consistent with other control-silo resources (auth, billing, integration installs, API tokens, slug reservations).

The wrong way to think about it: "this is a user-facing thing, so control." The right way: "what is the smallest silo where this can correctly live, and is that silo the same as everything that mutates it together?" If a cell never reads it, it does not belong in the cell.

### 2. Does the other silo need to see this data?

If yes, the model must inherit from `ReplicatedCellModel` (cell-side) or `ReplicatedControlModel` (control-side) and set `category: ClassVar[OutboxCategory] = OutboxCategory.MY_THING`. The base `Model` class is for data that genuinely never crosses the silo boundary.

Replication is part of the _design_, not a thing you bolt on later. If you have to ask "should other silo X be able to look this up by ID without an RPC?" — that is a replication decision, and it changes the base class. When in doubt, defer to the `hybrid-cloud-outboxes` skill before finalizing the model.

### 3. Is this data part of an organization export (relocation)?

Every concrete model must set `__relocation_scope__` — the runtime check at `src/sentry/db/models/base.py` raises if missing. The choice is almost always one of:

| Scope                          | When                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RelocationScope.Organization` | Customer data tied to an org that should travel with the org during a relocation. Includes most projects, settings, members, dashboards, alerts. |
| `RelocationScope.Excluded`     | Transient data, telemetry, caches, system-internal state, anything in the `getsentry` app, or data not meaningful in another instance.           |

A `set` of scopes with a `get_relocation_scope()` override exists but is rare; reach for it only when relocation behavior is per-instance conditional. `Excluded` cannot be part of a set.

If you are not sure: most new models that store a customer's working state are `Organization`; most new models that exist for Sentry's operations (queues, caches, attempts, jobs, feature flags consumed at runtime) are `Excluded`.

### 4. What is the cross-silo blast radius of each foreign key?

The FK type is an architectural statement, not a style choice:

- `FlexibleForeignKey("sentry.Project", on_delete=...)` — the FK target lives in the same silo. A real database constraint is created. Cascading delete is enforced by Postgres.
- `HybridCloudForeignKey("sentry.User", on_delete="...", ...)` — the FK target lives in the _opposite_ silo. No database constraint. Cascade is eventually consistent via outbox tombstones. `on_delete` is passed as a string (`"CASCADE"`, `"SET_NULL"`, `"DO_NOTHING"`). Name the field with an explicit `_id` suffix (e.g. `user_id = HybridCloudForeignKey(...)`) since there's no ORM relationship to resolve — only an ID. Compare with `FlexibleForeignKey`, where Django gives you both `project` (the related object) and `project_id` (the column) from a single `project = FlexibleForeignKey(...)`.
- Plain Django `ForeignKey` — avoid. A couple of older `workflow_engine` models still use it, but for new code the convention is `FlexibleForeignKey` (same-silo) or `HybridCloudForeignKey` (cross-silo). Both plug into Sentry's deletion framework and hybrid-cloud plumbing in ways plain `ForeignKey` does not.

If a model has both kinds of FKs, that is fine and common. The presence of an HCFK is _not_ a signal that the model should be in the other silo — it just means the relationship crosses silos.

## Other norms worth encoding

### Base class and timestamps

Use `DefaultFieldsModel` for new models. It gives you `date_added` (`auto_now_add=True`) and `date_updated` (`auto_now=True`) for free, and it's almost always what you want — tables that genuinely shouldn't track either timestamp are rare. `DefaultFieldsModelExisting` is legacy-only — its docstring explicitly says don't use it on new models (it leaves `date_added` nullable for backward compat with models that predate the field).

### Field-type intent

- `BoundedBigAutoField` for primary keys, `BoundedBigIntegerField` / `BoundedPositiveIntegerField` for non-PK numeric IDs and counts. The "bounded" part is a runtime overflow guard, not a Django nicety — it catches values that would silently corrupt downstream consumers.
- For bounded text fields without a strict spec, prefer `CharField(max_length=256)`. Postgres `varchar(n)` storage is identical regardless of `n` below the TOAST threshold, so picking 64 prematurely is a constraint without a benefit. Pick a smaller value only when the column has a real meaning (hash=40/64, UUID=32, slug, identifier with a spec).
- For free-form text fields, use `TextField`.
- For new JSON columns, prefer Django's `models.JSONField()` (jsonb-backed). The legacy `sentry.db.models.fields.jsonfield.JSONField` is text-backed and exists for compatibility with old columns — only use it when intentionally matching one.
- Mutable callable defaults (`default=dict`, `default=list`) — never bare `default={}` / `default=[]`.

### Soft delete is explicit

There is no metaclass-based soft delete. If a model needs soft delete, add an explicit `status` field using `ObjectStatus` and have business logic respect it. `ParanoidModel` exists (`SentryAppInstallation` uses it) but it is a heavyweight choice — most models should not need it.

### Constraints over `unique_together`

For new models, use `Meta.constraints = [UniqueConstraint(...)]` instead of `unique_together`. The reason is `condition=Q(...)`: partial unique constraints are the only correct way to express "unique when this column is not null", which is a common requirement and silently broken with `unique_together`. Constraint and index names should be explicit and descriptive, not auto-generated.

### Composite indexes match query order

If you filter on `(org_id, project_id, type)` together, you need an index whose field order matches the most-selective-first filter pattern. A foreign key auto-index does _not_ cover the multi-column case.

### Where the file lives

- Default: put new models in an app under `src/sentry/<app>/models.py` (single file) or `src/sentry/<app>/models/<thing>.py` (one model per file) — pick by precedent in the app.
- `src/sentry/models/<thing>.py` is the legacy location. Only put a new model there if it's tightly coupled to a model that already lives there and moving it would be disruptive.
- New apps under `src/sentry/<app>/` should set up a real Django app (`apps.py`, `__init__.py` with `default_app_config`).

## A minimal cell-silo model skeleton

This is a starting scaffold, not a template — strip what you do not need, do not add things you do not need.

```python
from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class MyThing(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    project = FlexibleForeignKey("sentry.Project")
    user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    name = models.CharField(max_length=256)
    config = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_mything"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="sentry_mything_org_name_unique",
            ),
        ]

    __repr__ = sane_repr("organization_id", "project_id", "name")
```

For a control-silo model, swap `@cell_silo_model` for `@control_silo_model`. For a model whose state needs to be visible from the other silo, change the base to `ReplicatedCellModel` or `ReplicatedControlModel` and add `category = OutboxCategory.MY_THING` — then invoke the `hybrid-cloud-outboxes` skill for the rest.

## After the model is designed

1. Generate the migration: invoke the `generate-migration` skill.
2. If the model is replicated: invoke the `hybrid-cloud-outboxes` skill to wire up payload, signal receivers, and deletion handlers.
3. If the app's `models/__init__.py` re-exports its models, add your new one there too — it's a convenience for callers (`from sentry.<app>.models import Thing`), not a Django requirement, so match the app's precedent.
