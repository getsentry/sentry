from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from sentry.models import ScheduledJob
from sentry.models.scheduledjob import schedule_jobs
from sentry.tasks.scheduler import enqueue_scheduled_jobs
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
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
        ) == {"sentry.tasks.enqueue_scheduled_jobs", "sentry.tasks.enqueue_scheduled_jobs_followup"}

    def test_schedule_job_order(self):
        with pytest.raises(ValidationError):
            job = [
                (
                    "sentry.tasks.enqueue_scheduled_jobs",
                    {"foo": "baz"},
                    timezone.now() + timedelta(days=1),
                )
            ]
            schedule_jobs(job)
            pytest.fail("ValidationError raised. Check order of inputs.")
