import dataclasses
from threading import local
from typing import Any, List, Tuple

import pytest
from celery.app.task import Task
from django.db import transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models.signals import ModelSignal

_SEP_LINE = "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"


@dataclasses.dataclass
class StaleDatabaseReads:
    model_signal_handlers: List[Tuple[Any, Any]]
    transaction_blocks: List[Any]

    def clear(self):
        self.model_signal_handlers.clear()
        self.transaction_blocks.clear()


def _raise_reports(reports: StaleDatabaseReads):
    if not reports.model_signal_handlers and not reports.transaction_blocks:
        return

    msg = f"""\
{_SEP_LINE}
We have detected that you are spawning a celery task in the following situations:
"""

    if reports.model_signal_handlers:
        for signal_sender, task_self in reports.model_signal_handlers:
            msg += f"  - A change to model {signal_sender} spawning a task {task_self.__name__}\n"

        msg += """
We found that such model signal handlers are often subtly broken in situations
where the model is being updated inside of a transaction. In this case the
spawned celery task can observe the old model state in production (where it
runs on a different machine) but not in tests (where it doesn't).

Typically the fix is to spawn the task using django.db.transaction.on_commit:

    # Before
    handle_model_changes.apply_async(...)
    # After
    transaction.on_commit(lambda: handle_model_changes.apply_async(...))
"""

    if reports.model_signal_handlers and reports.transaction_blocks:
        msg += f"""
{_SEP_LINE}
Additionally we found:
"""

    if reports.transaction_blocks:
        for task_self in reports.transaction_blocks:
            msg += f"  - A task {task_self.__name__} being spawned inside of a transaction.atomic block\n"

        msg += """
Those tasks can also observe outdated database state, and are better spawned
after the transaction has finished (using `django.db.transaction.on_commit` or
literally moving the code around).
        """

    msg += """
For an example of a real-world fix, see
https://github.com/getsentry/sentry/pull/35523, and for the PR that introduced
this fixture see https://github.com/getsentry/sentry/pull/35671

If you think this doesn't apply to this test, use the
`stale_database_reads` fixture like so at the end of the test:

    class MyTestCase(TestCase):
        def test_very_special(self):
            self.stale_database_reads.clear()

Or like this in pytest-based tests:

    def test_very_special(stale_database_reads):
        # Do something odd with models here

        stale_database_reads.clear()
{_SEP_LINE}"""

    pytest.fail(msg)


@pytest.fixture(autouse=True)
def stale_database_reads(monkeypatch):
    _state = local()

    old_send = ModelSignal.send

    def send(self, sender, **named):
        _state.in_signal_sender = getattr(sender, "__name__", repr(sender))
        try:
            return old_send(self, sender, **named)
        finally:
            _state.in_signal_sender = False

    monkeypatch.setattr(ModelSignal, "send", send)

    old_on_commit = transaction.on_commit

    # Needs to be hooked for autocommit
    def on_commit(*args, **kwargs):
        _state.in_on_commit = True
        try:
            return old_on_commit(*args, **kwargs)
        finally:
            _state.in_on_commit = False

    monkeypatch.setattr(transaction, "on_commit", on_commit)

    old_atomic = transaction.atomic

    def atomic(*args, **kwargs):
        _state.in_atomic = True
        try:
            return old_atomic(*args, **kwargs)
        finally:
            _state.in_atomic = False

    monkeypatch.setattr(transaction, "atomic", atomic)

    old_run_and_clear_commit_hooks = BaseDatabaseWrapper.run_and_clear_commit_hooks

    # Needs to be hooked for running commit hooks inside of TransactionTestCase
    def run_and_clear_commit_hooks(*args, **kwargs):
        _state.in_run_and_clear_commit_hooks = True
        try:
            return old_run_and_clear_commit_hooks(*args, **kwargs)
        finally:
            _state.in_run_and_clear_commit_hooks = False

    monkeypatch.setattr(
        BaseDatabaseWrapper, "run_and_clear_commit_hooks", run_and_clear_commit_hooks
    )

    reports = StaleDatabaseReads(model_signal_handlers=[], transaction_blocks=[])

    old_apply_async = Task.apply_async

    def apply_async(self, args=(), kwargs=(), **options):
        in_commit_hook = getattr(_state, "in_on_commit", None) or getattr(
            _state, "in_run_and_clear_commit_hooks", None
        )

        if getattr(_state, "in_signal_sender", None) and not in_commit_hook:
            reports.model_signal_handlers.append((_state.in_signal_sender, self))

        elif getattr(_state, "in_atomic", None) and not in_commit_hook:
            reports.transaction_blocks.append(self)

        return old_apply_async(self, args, kwargs, **options)

    monkeypatch.setattr(Task, "apply_async", apply_async)

    yield reports

    _raise_reports(reports)
