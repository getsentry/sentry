# Derived pipeline features

Follow `README.md` in this directory when changing Features or aggregators here.

## Features

- Hash mismatch triggers eventual regen; not all Groups update at once.
- Add: use immediately only if `default` is accurate; else wait for regen.
- Remove: safe if unused.
- Change computation: bump Feature `version`, or add a new feature for non-trivial shifts.
- Keep values small and bounded (last N, not full history).

## Aggregators (strict)

- Deterministic only: no I/O, randomness, clocks, or env.
- Aggregator APIs only (`emit`, `StateView`, deps/outputs/scope).
- Clarity first; keep hot paths fast when scope is large.
