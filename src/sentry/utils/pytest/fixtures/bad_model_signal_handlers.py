import pytest


def _format_msg(bad_signal_handlers):
    msg = """\
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
We have detected that you are spawning a celery task inside of a model signal
handler such as post_save or post_delete without using transaction.on_commit:
"""

    for signal_sender, task_self in bad_signal_handlers:
        msg += f"  - A change to model {signal_sender} spawning a task {task_self.__name__}\n"

    msg += """
We saw that this kind of signal handler is often subtly broken in how it
interacts with database transactions. Typically the fix is to change the signal
handler to use django.db.transaction.on_commit:

    def my_signal_handler(...):
        # Before
        handle_model_changes.apply_async(...)
        # After
        transaction.on_commit(lambda: handle_model_changes.apply_async(...))

For an example of a real-world fix, see
https://github.com/getsentry/sentry/pull/35523

If you think this doesn't apply to this test, use the
`bad_model_signal_handlers` fixture like so at the end of the test:

    class MyTestCase(TestCase):
        def test_very_special(self):
            self.bad_model_signal_handlers.clear()

Or like this in pytest-based tests:

    def test_very_special(bad_model_signal_handlers):
        # Do something odd with models here

        bad_model_signal_handlers.clear()
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"""

    return msg


@pytest.fixture(autouse=True)
def bad_model_signal_handlers(monkeypatch):
    from threading import local

    from celery.app.task import Task
    from django.db import transaction
    from django.db.models.signals import ModelSignal

    _state = local()
    bad_signal_handlers = []

    old_send = ModelSignal.send

    def send(self, sender, **named):
        _state.in_signal_sender = getattr(sender, "__name__", repr(sender))
        try:
            return old_send(self, sender, **named)
        finally:
            _state.in_signal_sender = False

    monkeypatch.setattr(ModelSignal, "send", send)

    old_on_commit = transaction.on_commit

    def on_commit(*args, **kwargs):
        _state.in_on_commit = True
        try:
            return old_on_commit(*args, **kwargs)
        finally:
            _state.in_on_commit = False

    monkeypatch.setattr(transaction, "on_commit", on_commit)

    old_apply_async = Task.apply_async

    def apply_async(self, args=(), kwargs=(), countdown=None):
        if getattr(_state, "in_signal_sender", None) and not getattr(_state, "in_on_commit", None):
            report = (_state.in_signal_sender, self)
            bad_signal_handlers.append(report)

        return old_apply_async(self, args, kwargs, countdown)

    monkeypatch.setattr(Task, "apply_async", apply_async)

    yield bad_signal_handlers

    if not bad_signal_handlers:
        return

    pytest.fail(_format_msg(bad_signal_handlers))
