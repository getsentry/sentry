# Sentry Built-in Fingerprinting Rules

This directory contains all the built-in fingerprinting rules.

## Directory Structure & Fingerprinting Bases

```
configs/
├── {config_name}@{config-version}/
│   ├── 001_{rules_set_name}.txt
│   ├── 002_{rules_set_name}.txt
⋮   ⋮
│   └── 00N_{rules_set_name}.txt
├── {config_name}@{config-version}/
│   ├── 001_{rules_set_name}.txt
│   ├── 002_{rules_set_name}.txt
⋮   ⋮
│   └── 00N_{rules_set_name}.txt
⋮
└── README.md # this file
```

Rules in each file `{config_name}@{config-version}/` are loaded at initialization
time into `FINGERPRINTING_BASES["{config_name}@{config-version}"]`.

The order of rules whithin each of these configs is deterministic, based on lexicographic
order of the files (hence numerical prefix is recommended).

## File Contents

Contents of the files should use syntax as described in https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/

## Naming conventions

- config name
  - `common` for rules that apply to everything;
  - plafrom name (eg. `javascript`) for platform specific rules;
  - SDK name (eg. `sentry.javascript.nextjs`) for SDK specific rules
- config version — a date in ISO format (eg. `2024-01-11`)
- individual rule files
  - numeric prefix to ensure the order
  - descriptive name (eg. `chunkload_errors`)
  - `.txt` suffix

## Using Built-in Fingerprinting Rules

To add one or more of these rule configs

```python
register_strategy_config(
    id="newstyle:YYYY-MM-DD",
    base="newstyle:YYYY-MM-DD", # Some other existing config
    risk=RISK_LEVEL_MEDIUM,
    changelog="""
        * Added built-in fingerprinting for Foo
        * Added built-in fingerprinting for Bar
    """,
    fingerprinting_bases=["foo@YYYY-MM-DD", "bar@YYYY-MM-DD"],
)
```

Fingerprinting configs will be applied in the order they appear
in the `fingerprinting_bases`.

Custom fingerprinting defined by user will allways
take precedence over built-in rules.
