from unittest import mock

from django.test import override_settings

from sentry.models.group import Group
from sentry.tasks.process_buffer import buffer_incr, process_incr, process_pending
from sentry.testutils.cases import TestCase


class ProcessIncrTest(TestCase):
    @mock.patch("sentry.buffer.backend.process")
    def test_calls_process(self, process):
        model = mock.Mock()
        columns = {"times_seen": 1}
        filters = {"pk": 1}
        process_incr(model=model, columns=columns, filters=filters)
        process.assert_called_once_with(model=model, columns=columns, filters=filters)


class ProcessPendingTest(TestCase):
    @mock.patch("sentry.buffer.backend.process_pending")
    def test_nothing(self, mock_process_pending):
        # this effectively just says "does the code run"
        process_pending()
        assert len(mock_process_pending.mock_calls) == 1
        mock_process_pending.assert_any_call(partition=None)

        process_pending(partition=1)
        assert len(mock_process_pending.mock_calls) == 2
        mock_process_pending.assert_any_call(partition=1)


class BufferIncrTest(TestCase):
    @override_settings(SENTRY_BUFFER_INCR_AS_CELERY_TASK=False)
    @mock.patch("sentry.tasks.process_buffer.buffer_incr_task")
    def test_buffer_incr_task(self, mock_buffer_incr_task):
        buffer_incr(Group)
        assert len(mock_buffer_incr_task.mock_calls) == 1
        # direct task call, no delay or apply_async
        assert mock_buffer_incr_task.mock_calls[0][0] == ""
        assert mock_buffer_incr_task.mock_calls[0].args == ()
        assert mock_buffer_incr_task.mock_calls[0].kwargs == {
            "app_label": "sentry",
            "model_name": "group",
            "args": (),
            "kwargs": {},
        }

    @override_settings(SENTRY_BUFFER_INCR_AS_CELERY_TASK=True)
    @mock.patch("sentry.tasks.process_buffer.buffer_incr_task")
    def test_buffer_incr_task_celery(self, mock_buffer_incr_task):
        buffer_incr(Group)
        assert len(mock_buffer_incr_task.mock_calls) == 1
        # call on delay method to spawn as a celery task
        assert mock_buffer_incr_task.mock_calls[0][0] == "delay"
        assert mock_buffer_incr_task.mock_calls[0].args == ()
        assert mock_buffer_incr_task.mock_calls[0].kwargs == {
            "app_label": "sentry",
            "model_name": "group",
            "args": (),
            "kwargs": {},
        }
