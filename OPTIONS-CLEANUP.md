# Options Cleanup Playbook

A guide for migrating Sentry options from the options system into Django settings.

## Why This Matters

The options system is powerful — runtime mutability, DB persistence, TTL caching — but that power has a cost: every option registered is infrastructure you have to operate. Options that were never actually changed at runtime, or that only make sense as static deployment config, are better expressed as plain Django settings. They're simpler to reason about, faster to read (no cache roundtrip), and don't pollute the setup wizard or admin UI.

---

## Configuration Layers: Self-Hosted vs SaaS

There are two distinct deployment paths, and they configure Sentry very differently.

### Self-Hosted (open-source sentry repo)

Configuration lives in two separate operator-managed files, usually under `~/.sentry/`:

**`~/.sentry/sentry.conf.py`** — Python file, exec'd by `importer.py` directly onto the Django
settings module. Every uppercase name becomes a Django setting. Loads on top of
`src/sentry/conf/server.py`. This is where operators write:
```python
DATABASES = {...}
CACHES = {...}
```

**`~/.sentry/config.yml`** — YAML file, parsed by `bootstrap_options()`. Keys use dot notation
and map to Sentry options:
```yaml
system.secret-key: "..."
mail.host: smtp.example.com
system.support-email: support@example.com
```

These are not two formats of the same thing. `config.yml` feeds `settings.SENTRY_OPTIONS`
(the options system). `sentry.conf.py` sets Django settings directly.

**`src/sentry/conf/server.py`** — in-repo base defaults for all Django settings. Never edited
by operators; edited by engineers to add or change settings.

**The `options_mapper` bridge** (`initializer.py`): a small dict that promotes a subset of
YAML options into Django settings before `django.setup()`. Exists because Django internals and
third-party libs read settings like `EMAIL_HOST` directly — they can't go through
`options.get()`. The mapper reads `SENTRY_OPTIONS` and calls `setattr(settings, ...)`.

### SaaS (getsentry repo)

GetSentry does not use `config.yml` or `sentry.conf.py` at all. It is a pure Python settings
hierarchy that starts by importing everything from Sentry and then overriding:

```
DJANGO_SETTINGS_MODULE=getsentry.settings  (always)
          │
          └─► getsentry/settings.py
                  │
                  ├─ from getsentry.conf.settings.defaults import *
                  │       └─ from sentry.conf.server import *   ← Sentry base defaults
                  │          (then GetSentry extensions, SENTRY_OPTIONS assignments, etc.)
                  │
                  └─ DJANGO_CONF env var selects environment overlay:
                       dev         → getsentry/conf/settings/dev.py
                       test        → getsentry/conf/settings/test.py
                       cellsilo    → getsentry/conf/settings/cellsilo.py   (region silo prod)
                       controlsilo → getsentry/conf/settings/controlsilo.py
```

`DJANGO_CONF` (or `GETSENTRY_DJANGO_CONF`) is a GetSentry-custom env var that `getsentry/settings.py`
reads to dynamically `__import__` the appropriate module and merge its globals. It is not a
Django concept.

In getsentry, options are set directly in Python rather than via YAML:
```python
# getsentry/conf/settings/defaults.py
SENTRY_OPTIONS["system.support-email"] = "support@sentry.io"
SENTRY_OPTIONS["system.admin-email"] = "hello@sentry.io"
```

Because getsentry's `defaults.py` starts with `from sentry.conf.server import *`, the
`SENTRY_OPTIONS` dict already exists (defined in `server.py`) and is mutated in place.

### Getsentry anti-pattern: option registration in `getsentry/models/__init__.py`

`getsentry/models/__init__.py` registers many options as a side effect of model loading —
roughly 800 lines of `register(...)` calls mixed in with model definitions. This is an
anti-pattern for two reasons:

1. **Side effects on model import.** Django models should be passive; registering options
   couples the model import order to the options system initialisation order.
2. **Options that belong in settings.** Some of these (e.g. `FLAG_NOSTORE` credentials like
   `codecov.signing_secret`, `github.client-id`) should instead be Django settings or
   environment variables, not options.

The intended home for getsentry-specific option registrations is a dedicated
`getsentry/options/defaults.py` module that is loaded via `AppConfig.ready()`:

```python
# getsentry/conf/apps.py
class GetSentryConfig(AppConfig):
    name = "getsentry"

    def ready(self):
        from getsentry.options import defaults  # noqa: F401 registers options
```

This would decouple option registration from model import, make it happen at the right
point in the Django lifecycle, and make the file easy to find.

## Architecture: Initialization Order

### Self-Hosted

```
importer.py
  └─► loads src/sentry/conf/server.py (base defaults)
  └─► exec's ~/.sentry/sentry.conf.py (operator Python overrides)

initialize_app(config_path)
        │
        ├─ 1. bootstrap_options(settings, ~/.sentry/config.yml)
        │       ├─ load_defaults()           ← registers options in defaults.py
        │       ├─ parse config.yml          ← raw YAML dict
        │       ├─ COMPAT: old Django settings → warn + copy to SENTRY_OPTIONS
        │       ├─ dump config.yml values    → settings.SENTRY_OPTIONS
        │       └─ options_mapper promotion  → e.g. "mail.from" → settings.SERVER_EMAIL
        │
        ├─ 2. configure_structlog()
        ├─ 3. django.setup()          ◄── SETTINGS FROZEN AFTER THIS POINT
        ├─ 4. validate_options()
        ├─ 5. bind_cache_to_option_store()
        ├─ 6. register_plugins() / initialize_receivers()
        └─ 7. configure_sdk()
```

### SaaS (GetSentry)

```
DJANGO_SETTINGS_MODULE=getsentry.settings
  └─► getsentry/conf/settings/defaults.py
        └─► from sentry.conf.server import *
        └─► SENTRY_OPTIONS["x.y"] = ...  (set directly in Python)
  └─► getsentry/conf/settings/{DJANGO_CONF}.py
        └─► additional overrides for environment

initialize_app()  ← same Sentry function, called via Django AppConfig
        │         ← no config.yml; SENTRY_OPTIONS already populated by settings import
        ├─ bootstrap_options(settings, config=None)
        │       ├─ load_defaults()
        │       └─ options_mapper promotion (reads from already-populated SENTRY_OPTIONS)
        ├─ django.setup()          ◄── SETTINGS FROZEN
        └─ ... (same as above)
```

**Django settings** (`settings.KEY`): immutable after `django.setup()`. Set by `sentry.conf.py`
(self-hosted) or by the getsentry Python hierarchy (SaaS). Base defaults always come from
`src/sentry/conf/server.py`.

**Sentry options** (`options.get("x.y")`): registered in `src/sentry/options/defaults.py`.
Read path at request time:
1. `FLAG_PRIORITIZE_DISK` set and key in `settings.SENTRY_OPTIONS`? → return immediately
2. Local in-memory cache (10s TTL, 60s grace period)
3. Redis shared cache
4. Database (`Option` / `ControlOption` model)
5. `settings.SENTRY_DEFAULT_OPTIONS` (registered defaults)

---

## Option Flags — Don't Trust Them Blindly

The flags on a registered option tell you *how the system treats it*, not *how it was
intended to be used*. In practice, flags are often copy-pasted from a nearby option without
much thought. Treat them as a starting point for investigation, not a verdict.

| Flag | What it means | What it doesn't mean |
|---|---|---|
| `FLAG_NOSTORE` | Not persisted to DB | Was deliberately chosen over a Django setting |
| `FLAG_PRIORITIZE_DISK` | Config-file value wins over DB value | The option is actually set on disk anywhere |
| `FLAG_IMMUTABLE` | Cannot be changed at runtime | Was carefully audited; may just be a habit |
| `FLAG_AUTOMATOR_MODIFIABLE` | Options Automator is *allowed* to change it | The Automator actually *does* change it |
| `FLAG_ADMIN_MODIFIABLE` | UI admin is *allowed* to change it | Anyone actually uses this UI capability |
| `FLAG_REQUIRED` | Fails validation if unset | Must stay in the options system |
| `FLAG_ALLOW_EMPTY` | Passes validation when empty | Is intentionally optional |
| `FLAG_CREDENTIAL` | Hidden from UI | Contains anything sensitive today |

---

## What Makes a Good Migration Candidate

Work through these questions in order. Stop as soon as you hit a "no" — that's a sign the
option probably needs to stay.

### 0. Finding candidates: code analysis has limits

Static grep analysis cannot reliably find truly orphaned options. Every registered key
appears somewhere as a string literal — in relay config lists, detector-type dicts, test
helpers, etc. — so zero-hit counts are misleading. The gap between "key appears in code" and
"key is actually read at runtime" requires runtime data to close.

**Reliable signals for dead options:**
- **Runtime telemetry**: instrument `options.get()` to emit metrics by key; look for keys
  with zero hits over a rolling 30-day window in production.
- **DB inspection**: query `Option`/`ControlOption` for keys that have never been written
  (combined with no recent log reads). Options never written to the store, with no reads,
  are strong candidates — though `FLAG_NOSTORE` options won't have DB rows regardless.
- **Team knowledge**: go through option families by prefix (`relay.*`,
  `performance.issues.*`, `sentry-metrics.*`) with the owning team.

**For confirming a specific candidate is safe to delete:**

```bash
key="the.option.key"
grep -rn "\"$key\"\|'$key'" src/ tests/ /Users/josh/dev/getsentry/ --include="*.py"
```

Ask: is there any `options.set(...)` call, or any code path that expects the value to change
between requests without a deploy? If yes, it belongs in the options system.

### 2. Does it need to differ across region silos at runtime?

Some options are genuinely per-region operational knobs. If the option lives in a region
context and could reasonably differ between us-east and eu-central without a deploy, keep it.

### 3. Does the Options Automator actually touch it?

`FLAG_AUTOMATOR_MODIFIABLE` on the registration is not proof. Search the `sentry-options-automator`
repo (or its YAML configs) for the option key. If it's not there, the flag is vestigial.

### 4. Does the setup wizard or admin system options UI expose it?

Check `src/sentry/api/endpoints/system_options.py`. Options listed there are surfaced to
self-hosted operators in the UI. Moving them out of options removes that UI knob. Decide
whether that's acceptable — for most infra config it is.

### 5. Is the value available early enough?

Django settings must be fully resolved before `django.setup()`. Options that are only needed
at request time (after `bind_cache_to_option_store`) have more flexibility. But if you want a
Django setting, the value must come from `config.yml` or `sentry.conf.py`.

### The strongest migration candidates

Options that pass all of the above **and** have one of these profiles:

- Already has `FLAG_NOSTORE` — it was never stored in DB; it's already effectively static config.
- Already has `FLAG_PRIORITIZE_DISK` and has no store counterpart that's ever set — the disk
  value always wins anyway.
- Is used by exactly one call site that just reads it and returns it as a string.
- Has no default value and is almost always empty (operators who need it set it at deploy time).

Examples that are strong candidates: `system.base-hostname`, `system.organization-base-hostname`,
`system.logging-format`, `system.databases` (already `FLAG_NOSTORE`).

---

## How to Migrate: Step-by-Step

The approach below (Option A) preserves backward compatibility for self-hosted operators
(their `config.yml` key continues to work) and requires only a small change in getsentry.

### Step 1 — Add a Django setting in `src/sentry/conf/server.py`

Add the setting to the `DEAD` block (near the end of the file, after `DEAD = object()` is
defined) and put the default value in `SENTRY_DEFAULT_OPTIONS`:

```python
# in the DEAD block (~line 2360)
SENTRY_SUPPORT_EMAIL = DEAD

# in SENTRY_DEFAULT_OPTIONS (~line 2141)
SENTRY_DEFAULT_OPTIONS: dict[str, Any] = {
    ...
    "system.support-email": "",
}
```

**Why DEAD, not a real default?** `bootstrap_options()` step 1 warns if a Django setting
is defined (not DEAD) but the corresponding option is not set in config.yml. If you put a
real default in server.py, the warning fires on every startup even when no one set the
setting. Using `DEAD` and putting the default in `SENTRY_DEFAULT_OPTIONS` means step 3 of
`bootstrap_options()` sets the Django setting from the default, with no spurious warning.

Use a `SENTRY_` prefix for options that aren't standard Django settings. Use the standard
Django name if the setting is one Django or a third-party library already knows about.

### Step 2 — Add to `options_mapper` in `src/sentry/runner/initializer.py`

```python
options_mapper = {
    ...
    "system.support-email": "SENTRY_SUPPORT_EMAIL",
}
```

This promotes the config.yml value to a Django setting during `bootstrap_options()`, before
`django.setup()` freezes the settings.

### Step 3 — Remove the `register()` call from `src/sentry/options/defaults.py`

Delete the entry entirely. If you're not sure whether removing it is safe, add a deprecation
shim first (log a warning when the key is read from the old store) and let it ride for a
release before deleting.

### Step 4 — Update all call sites

Change every `options.get("system.support-email")` to `settings.SENTRY_SUPPORT_EMAIL`.
For options read in template tags or request-time code, this is a direct substitution.

### Step 5 — Handle any `options.set(...)` call sites

If any code calls `options.set("the.option.key", ...)`, you need to decide: either remove
the set (if it was vestigial) or reconsider whether the option should really be migrated.

### Step 6 — Remove from system_options endpoint if present

If the option was listed in `src/sentry/api/endpoints/system_options.py`, remove it. The
setting is now configured at deploy time, not via the API.

### Step 7 — Update getsentry

If getsentry's `defaults.py` sets the option via `SENTRY_OPTIONS["the.key"] = ...`, change it
to set the new Django setting directly:

```python
# getsentry/conf/settings/defaults.py
# before:
SENTRY_OPTIONS["system.support-email"] = "support@sentry.io"
# after:
SENTRY_SUPPORT_EMAIL = "support@sentry.io"
```

With the options_mapper approach, getsentry's existing `SENTRY_OPTIONS[...]` assignment
continues to work as-is — `bootstrap_options()` will promote it to the Django setting
automatically. Step 7 is therefore optional and can be done as a follow-up cleanup.

---

## Worked Example: `system.support-email`

**Before** (`defaults.py`):
```python
register(
    "system.support-email",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
```

**Audit findings:**
- One read site: `_get_support_mail()` in `web/client_config.py`
- No `options.set()` calls anywhere
- Not listed in `system_options.py`
- `FLAG_AUTOMATOR_MODIFIABLE` is vestigial — not present in `sentry-options-automator` YAML
- `FLAG_PRIORITIZE_DISK` means the DB value is never actually used if config.yml has it

**Changes:**

`src/sentry/conf/server.py` — DEAD sentinel in the DEAD block, default in SENTRY_DEFAULT_OPTIONS:
```python
# DEAD block:
SENTRY_SUPPORT_EMAIL = DEAD

# SENTRY_DEFAULT_OPTIONS:
SENTRY_DEFAULT_OPTIONS: dict[str, Any] = {
    ...
    "system.support-email": "",
}
```

`src/sentry/runner/initializer.py` — add to `options_mapper`:
```python
"system.support-email": "SENTRY_SUPPORT_EMAIL",
```

`src/sentry/options/defaults.py` — delete:
```python
register(
    "system.support-email",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
```

`src/sentry/web/client_config.py`:
```python
def _get_support_mail() -> str | None:
    from django.conf import settings
    return settings.SENTRY_SUPPORT_EMAIL or options.get("system.admin-email") or None
```

Self-hosted operators with `system.support-email: foo@example.com` in `config.yml` continue
to work without any config changes — `bootstrap_options()` promotes it to
`settings.SENTRY_SUPPORT_EMAIL` via the mapper.

In getsentry, `defaults.py` already has:
```python
SENTRY_OPTIONS["system.support-email"] = "support@sentry.io"
```
With Option A this also continues to work as-is: `bootstrap_options()` sees the value in
`SENTRY_OPTIONS` and promotes it. No immediate getsentry change required.

---

## Testing

After migrating:

```bash
# Verify no remaining options.get() calls for the key
grep -rn '"system.support-email"' src/ tests/ --include="*.py"

# Run affected tests
.venv/bin/pytest -n3 -svv --reuse-db tests/sentry/web/test_client_config.py

# Smoke-test bootstrap with a config that has the key set
echo "system.support-email: test@example.com" >> /tmp/test-config.yml
# verify SENTRY_SUPPORT_EMAIL is populated after bootstrap_options()
```

---

## Epilogue: Dropping the options_mapper Bridge (Future Cleanup)

The migration above keeps the `config.yml` key alive via `options_mapper`. That's the only
safe path for a first migration — self-hosted operators must not be required to change their
config files.

Once a setting has been in `options_mapper` for long enough that you're confident no active
self-hosted deployment still sets the old YAML key (typically after a major version boundary
or an explicit deprecation cycle), you can complete the cleanup:

1. Remove the key from `options_mapper` in `initializer.py`
2. Remove the Django setting default from `server.py` if it has no other value source, or
   document that operators now set it directly in `sentry.conf.py`:
   ```python
   # ~/.sentry/sentry.conf.py
   SENTRY_SUPPORT_EMAIL = "support@example.com"
   ```
3. Update getsentry's `defaults.py` to assign the Django setting directly instead of via
   `SENTRY_OPTIONS`:
   ```python
   # before:
   SENTRY_OPTIONS["system.support-email"] = "support@sentry.io"
   # after:
   SENTRY_SUPPORT_EMAIL = "support@sentry.io"
   ```

This second step is a genuine layer-change for self-hosted operators: `config.yml` and
`sentry.conf.py` are different files with different syntax. Never do this step without a
deprecation notice in the release that removed the YAML key from `options_mapper`.
