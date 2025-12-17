## ✅ What type checker runs in CI

CI runs **mypy**.

- The workflow job is `typing` in `.github/workflows/backend.yml`.
- The command CI executes is:
  - `PYTHONWARNINGS=error::RuntimeWarning mypy`
- mypy configuration comes from `[tool.mypy]` in `pyproject.toml` (including the “module blocklist” section `# begin: sentry modules with typing issues`).

## 🔁 How I reproduced the CI run locally

I mirrored the CI steps closely:

- Install Python + deps from lockfile:
  - `uv python install 3.13.1`
  - `uv sync --frozen --active`
- CI “lite” setup:
  - `python3 -m tools.fast_editable --path .`
  - `sentry init`
- Run the type checker:
  - `PYTHONWARNINGS=error::RuntimeWarning mypy`

## 📌 What new errors appeared

Running the CI command produced:

- **78 errors in 35 files** (checked ~7.3k files)

The errors cluster heavily into a few themes:

- **Custom queryset methods not visible on managers/querysets**
  - e.g. `using_replica`, `with_post_update_signal`, `update_with_returning`
  - Example symptoms:
    - `"BaseManager[M]" has no attribute "using_replica"`
    - `"QuerySet[...]" has no attribute "with_post_update_signal"`
- **Return type mismatches: `QuerySet[...]` vs `BaseQuerySet[...]`**
  - Many functions/methods expect `BaseQuerySet[...]` but expressions are inferred as plain `QuerySet[...]`.
- **A small amount of cleanup**
  - e.g. `Unused "type: ignore" comment`

## 🧠 Likely root cause / why these surfaced now

The dominant error shape strongly suggests a typing “plumbing” issue rather than dozens of independent, real bugs.

In `src/sentry/db/models/manager/base.py`, `BaseManager` currently uses a `TYPE_CHECKING` conditional:

- At **type-check time**, it inherits from `django.db.models.manager.Manager` directly.
- At **runtime**, it inherits from `Manager.from_queryset(BaseQuerySet, ...)`.

That means:

- mypy does **not** see queryset-proxied methods on the manager during type checking, even though they exist at runtime.
- Any call site using `Model.objects.<custom_queryset_method>()` is typed as invalid.
- Once you improved the type system elsewhere, mypy is now able to “see” more of these mismatches, so they bubble up broadly.

This single pattern explains a large fraction of the new errors.

## 🛠️ Proposed fix plan

### 1) Fix the manager/queryset typing bridge first (high leverage)

Goal: make mypy understand that `BaseManager` exposes `BaseQuerySet` methods.

- **Remove or adjust the `TYPE_CHECKING` split** so that mypy sees `from_queryset(BaseQuerySet)` behavior.
  - Ideally `BaseManager` should be typed as a manager “built from” `BaseQuerySet`.
  - If Django-stubs typing limitations forced the old conditional, consider:
    - defining a typed base via `from_queryset` unconditionally and adding a narrowly-scoped `typing.cast` / `# type: ignore[...]` in exactly one place (instead of dozens of downstream errors)
    - or introducing a small `Protocol` that captures the methods we need (`using_replica`, `with_post_update_signal`, `update_with_returning`) and typing `BaseManager` as implementing that protocol.

Expected impact: this should eliminate most of:

- `... has no attribute using_replica/with_post_update_signal/update_with_returning`
- many `QuerySet` vs `BaseQuerySet` mismatches caused by manager inference

### 2) Re-run `mypy` and re-baseline the remaining error set

After step (1), re-run:

- `PYTHONWARNINGS=error::RuntimeWarning mypy`

Then:

- Count remaining errors
- Group them by error kind and module area

This tells us whether we’re dealing with:

- mostly “typing infrastructure” fallout (likely)
- or a long tail of real typing issues

### 3) Fix remaining errors by category (targeted, repeatable)

Typical follow-ups (depending on what remains):

- **Return type annotations**
  - If a function claims it returns `BaseQuerySet[...]` but can only guarantee `QuerySet[...]`, loosen the signature.
  - If it truly returns the custom queryset, adjust the implementation so mypy can infer it (often by ensuring it originates from a properly typed manager/queryset).
- **Manager/queryset method availability**
  - Where calls are made on `QuerySet` objects that are typed as plain Django `QuerySet`, ensure they are constructed from `BaseQuerySet`.
  - Avoid sprinkling `cast()` at call sites unless there’s no better option.
- **Cleanups**
  - Remove now-unneeded `# type: ignore[...]` comments once the underlying types are corrected.

### 4) Decide on rollout strategy: fix vs ignore vs hybrid

Given the current numbers (78 errors / 35 files) and the strong single-root-cause signal, I **do not recommend ignoring** these wholesale.

- **If step (1) clears most errors** (my expectation):
  - ✅ Fix them properly (best ROI, keeps the new type-system improvements)
- **If step (1) helps but there’s still a large tail**:
  - ✅ Use a **hybrid** approach:
    - Fix the high-leverage typing infrastructure now
    - Temporarily suppress the remaining errors using the existing “module blocklist” mechanism in `pyproject.toml`
    - Chip away at the blocklist incrementally (module-by-module), keeping CI green

I’d only recommend “ignore” if the remaining errors are extremely widespread and the fixes require large refactors across unrelated subsystems.

### 5) (Optional) Assess the true typing debt without the blocklist

To understand total debt (not necessarily to fix immediately), run:

- `python3 -m tools.mypy_helpers.mypy_without_ignores`

This strips the “modules with typing issues” override and shows what’s currently being hidden. This is useful for deciding how aggressive to be about paying down typing debt after the type-system change.

## ⏱️ Difficulty / effort estimate

Based on the shape of the errors I saw:

- **Likely low-to-moderate overall** (because many errors look like the same underlying manager/queryset typing issue).
- Rough estimate:
  - **Step (1)** (manager/queryset typing bridge): ~0.5–1 day
  - **Step (2–3)** (remaining cleanup once the bridge is fixed): ~0.5–2 days
  - **If a large long tail remains** after the bridge fix: could expand to a multi-week incremental effort, but at that point I’d strongly favor the hybrid approach.

## ❓Question for you (only if the intent differs)

If your type-system fix is intended to _enforce_ stronger `BaseQuerySet` usage everywhere, I’ll bias the plan toward tightening annotations.

If instead it’s intended to be “mostly compatible” and avoid forcing broad `BaseQuerySet` usage, we should loosen some annotations to accept `QuerySet` more often.
