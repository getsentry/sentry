from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from sentry.utils.compat.mock import patch

import pytest

from sentry.models import ScheduledJob
from sentry.models.scheduledjob import schedule_jobs
from sentry.testutils import TestCase
from sentry.tasks.scheduler import enqueue_scheduled_jobs


class EnqueueScheduledJobsTest(TestCase):
    def test_does_not_schedule_future_job(self):
        sj = ScheduledJob.objects.create(
            name="sentry.tasks.enqueue_scheduled_jobs",
            payload={"foo": "baz"},
            date_scheduled=timezone.now() + timedelta(days=1),
        )

        enqueue_scheduled_jobs()

        assert ScheduledJob.objects.filter(id=sj.id).exists()

    @patch("sentry.celery.app.send_task")
    def test_schedules_due_job(self, mock_send_task):
        sj = ScheduledJob.objects.create(
            name="sentry.tasks.enqueue_scheduled_jobs",
            payload={"foo": "bar"},
            date_scheduled=timezone.now(),
        )

        enqueue_scheduled_jobs()

        assert not ScheduledJob.objects.filter(id=sj.id).exists()

        mock_send_task.assert_called_once_with(
            "sentry.tasks.enqueue_scheduled_jobs", kwargs={"foo": "bar"}
        )

    def test_schedule_job(self):
        job = [
            (
                {"foo": "baz"},
                "sentry.tasks.enqueue_scheduled_jobs",
                timezone.now() + timedelta(days=1),
            ),
            (
                {"foo": "baz"},
                "sentry.tasks.enqueue_scheduled_jobs_followup",
                timezone.now() + timedelta(days=1),
            ),
        ]
        schedule_jobs(job)
        assert set(
            ScheduledJob.objects.filter(payload={"foo": "baz"}).values_list("name", flat=True)
        ) == set(
            ["sentry.tasks.enqueue_scheduled_jobs", "sentry.tasks.enqueue_scheduled_jobs_followup"]
        )

    def test_schedule_job_order(self):
        with pytest.raises(
            ValidationError, message="ValidationError raised. Check order of inputs"
        ):
            job = [
                (
                    "sentry.tasks.enqueue_scheduled_jobs",
                    {"foo": "baz"},
                    timezone.now() + timedelta(days=1),
                )
            ]
            schedule_jobs(job)
