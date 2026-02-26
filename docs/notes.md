# Tiered xdist v2 — Design Notes

## Why Relay needs per-worker Docker containers

Each xdist worker needs its own Relay container because Relay's config is baked in at startup:
- Kafka topics: each worker writes to its own topics (`ingest-events-gw0` vs `ingest-events-gw1`)
- Redis DB: each worker uses its own DB number
- Snuba instance: each worker routes to its own Snuba on a different port

A single Relay container can only have one config, so sharing across workers is not possible.

Within a single worker, we can't share one container across test classes because `TransactionTestCase` flushes the DB between tests, deleting the Relay model row that Sentry uses to authenticate Relay (401s without it). The `_ensure_relay_in_db()` call before each test re-inserts the row, but the container itself persists across tests in the same class.

Currently one container per test (function-scoped). Could be optimized to **one container per worker session** since `live_server` (pytest-django) is session-scoped. Only ~6 relay test classes exist. This optimization is separated from the xdist correctness changes (per-worker naming/ports) to keep concerns clean. The function-scoped `relay_server` fixture would become a thin wrapper calling `_ensure_relay_in_db()` + `adjust_settings_for_relay_tests()`.

## Why Snuba URL must be set before `initialize_app()`

`sentry.utils.snuba` creates a module-level connection pool singleton (`_snuba_pool`) from `settings.SENTRY_SNUBA` at import time. `initialize_app()` transitively triggers that import through the Django app loading chain (100+ modules reference `sentry.utils.snuba`). So `settings.SENTRY_SNUBA` must be overridden before `initialize_app()` is called in `pytest_configure`.

We verified that `sentry.utils.snuba` is NOT imported during plugin loading (before `pytest_configure`), so overriding the setting in `pytest_configure` is early enough. No module-level env var hack needed.

## Why lazy imports inside fixtures are OK but inside class methods are not

Pytest fixtures are lazily invoked — the import only runs when a test actually requests the fixture. This is standard pytest practice for optional/heavy dependencies. Moving imports from module-level into a fixture function body is a single import per fixture, clean and sustainable.

Scattering imports inside every method of a class (like the `Browser` class in selenium.py) is unsustainable — anyone adding a new method must remember to add the import. The better approach for selenium is conditional plugin loading via env var.

## pytest-rerunfailures crash recovery under xdist

The experiment branch disabled `pytest_rerunfailures.HAS_PYTEST_HANDLECRASHITEM`, claiming the socket-based crash recovery protocol deadlocks during heavy xdist startup due to connection timeouts. However, reading the actual source code (v15.0), the server thread (`ServerStatusDB`) calls `self.sock.accept()` in an infinite loop with no timeout, and the socket is set to `setblocking(1)` with no timeout on `recv(1)`. There is no connection window that workers can miss. The deadlock explanation from the experiment docs doesn't match the code. Skip this change and only revisit if we actually hit freezes when enabling xdist.

## Why hash-based sharding beats algorithmic LPT

With 17+ shards and ~32K tests, the law of large numbers gives hash-based (`sha256(nodeid) % N`) sharding good-enough balance (~90-130s spread). LPT algorithms failed because:
- Test count is a poor proxy for duration (files with few slow integration tests get treated as "light")
- Flat duration LPT optimizes `sum(worker_loads)` but actual wall clock = `max(worker_loads)` — it ignores intra-shard parallelism
- Indivisible mega-scopes (large test classes) create unavoidable hotspots under scope-preserving algorithms
