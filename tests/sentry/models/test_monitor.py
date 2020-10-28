from __future__ import absolute_import, print_function

import six

from datetime import datetime
from django.utils import timezone
from mock import patch
from sentry.models import Monitor, MonitorFailure, MonitorType, ScheduleType
from sentry.testutils import TestCase


class MonitorTestCase(TestCase):
    def test_next_run_crontab_implicit(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={"schedule": "* * * * *"},
        )
        assert monitor.get_next_scheduled_checkin() == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor.get_next_scheduled_checkin() == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        assert monitor.get_next_scheduled_checkin() == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor.get_next_scheduled_checkin() == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_interval(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.get_next_scheduled_checkin() == datetime(
            2019, 2, 1, 1, 10, 20, tzinfo=timezone.utc
        )

    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_default_params(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.mark_failed()

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "active",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, u"month"]},
                        "id": six.text_type(monitor.guid),
                        "name": monitor.name,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (unknown)"},
                "fingerprint": ["monitor", six.text_type(monitor.guid), u"unknown"],
                "logger": "",
                "type": "default",
            }
        ) == dict(event)

    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_reason(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.mark_failed(reason=MonitorFailure.DURATION)

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "active",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, u"month"]},
                        "id": six.text_type(monitor.guid),
                        "name": monitor.name,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (duration)"},
                "fingerprint": ["monitor", six.text_type(monitor.guid), u"duration"],
                "logger": "",
                "type": "default",
            }
        ) == dict(event)
