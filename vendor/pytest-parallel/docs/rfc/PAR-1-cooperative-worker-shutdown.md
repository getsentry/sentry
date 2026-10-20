# PAR-1: Workers finish the current test before a global stop

Status is accepted.

## A global stop waits 5 seconds

Both `-x` and `--maxfail` store `maxfail`. Pytest sets `session.shouldfail` once failures reach that count. When `_monitor` sees `session.shouldfail` or `session.shouldstop`, it touches the `stop` file and keeps reading worker events.

The constant `_STOP_DRAIN_TIMEOUT` is 5 seconds. You cannot change that limit from the command line. There is no `--parallel-drain-timeout` flag.

At the deadline, `_terminate_live_workers` sends SIGTERM. It waits up to 1 second, then sends SIGKILL.

The coordinator does not signal a worker that has already exited.

## The current test runs to completion

The worker reads `stop` at the start of `pytest_runtest_protocol` and at the end of `pytest_runtest_logfinish`.

A test that has already entered the protocol runs its teardown and emits its reports. The worker does not cancel that test.

If `stop` exists before a test starts, the worker sets `session.shouldstop` to `stopped by coordinator` and returns from the protocol hook. Pytest does not run that test.

When the worker exits on its own, it emits `session_finish`. A worker killed at the deadline may not emit that event.

## Unstarted tests are not crashes

`_reconcile_worker` returns immediately when the coordinator requested the stop and the worker stream has no protocol error.

Assigned tests that never ran stay unreported. The coordinator does not mark them skipped, and it does not file a crash for them.

A protocol error is still a failure after the stop.

## SIGINT and SIGTERM wait 1 second

The coordinator turns SIGTERM into `KeyboardInterrupt`. SIGINT raises the same exception.

On `KeyboardInterrupt`, `_monitor` touches the same `stop` file. It joins the workers for at most 1 second. It then calls `_terminate_live_workers` and re-raises.

This path does not use the 5 second poll. `_reconcile_worker` does not run.

`Coordinator.run` still terminates any worker that is left and deletes the run directory.

## These alternatives lost

Immediate SIGTERM in the same loop that creates `stop` lost. Fixture teardown would not run.

An unbounded wait lost. A hung test would keep the session open.

A `--parallel-drain-timeout` flag lost. The limit is the constant 5 seconds.

Reporting tests that never started as skipped lost. A skip would invent a result the worker did not produce.
