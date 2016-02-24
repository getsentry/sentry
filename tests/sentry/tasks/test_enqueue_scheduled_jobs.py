from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone
from mock import patch

from sentry.models import ScheduledJob
from sentry.testutils import TestCase
from sentry.tasks.scheduler import enqueue_scheduled_jobs


class EnqueueScheduledJobsTest(TestCase):
    def test_does_not_schedule_future_job(self):
        sj = ScheduledJob.objects.create(
            name='sentry.tasks.enqueue_scheduled_jobs',
            payload={'foo': 'baz'},
            date_scheduled=timezone.now() + timedelta(days=1),
        )

        enqueue_scheduled_jobs()

        assert ScheduledJob.objects.filter(
            id=sj.id,
        ).exists()

    @patch('sentry.celery.app.send_task')
    def test_schedules_due_job(self, mock_send_task):
        sj = ScheduledJob.objects.create(
            name='sentry.tasks.enqueue_scheduled_jobs',
            payload={'foo': 'bar'},
            date_scheduled=timezone.now(),
        )

        enqueue_scheduled_jobs()

        assert not ScheduledJob.objects.filter(
            id=sj.id,
        ).exists()

        mock_send_task.assert_called_once_with(
            'sentry.tasks.enqueue_scheduled_jobs',
            kwargs={'foo': 'bar'},
        )
