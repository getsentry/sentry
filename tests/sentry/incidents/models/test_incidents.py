import unittest
from datetime import timedelta
from unittest.mock import patch

from django.db import router, transaction
from django.utils import timezone

from sentry.db.models.manager.base import BaseManager
from sentry.incidents.models.incident import (
    Incident,
    IncidentStatus,
    IncidentType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class IncidentCreationTest(TestCase):
    def test_simple(self) -> None:
        title = "hello"
        alert_rule = self.create_alert_rule()
        incident = Incident.objects.create(
            self.organization,
            title=title,
            type=IncidentType.ALERT_TRIGGERED.value,
            alert_rule=alert_rule,
        )
        assert incident.identifier == 1
        assert incident.title == title

        # Check identifier correctly increments
        incident = Incident.objects.create(
            self.organization,
            title=title,
            type=IncidentType.ALERT_TRIGGERED.value,
            alert_rule=alert_rule,
        )
        assert incident.identifier == 2

    def test_identifier_conflict(self) -> None:
        create_method = BaseManager.create
        call_count = [0]
        alert_rule = self.create_alert_rule()

        def mock_base_create(*args, **kwargs):
            if not call_count[0]:
                call_count[0] += 1
                # This incident will take the identifier we already fetched and
                # use it, which will cause the database to throw an integrity
                # error.
                with transaction.atomic(router.db_for_write(Incident)):
                    incident = Incident.objects.create(
                        self.organization,
                        status=IncidentStatus.OPEN.value,
                        title="Conflicting Incident",
                        type=IncidentType.ALERT_TRIGGERED.value,
                        alert_rule=alert_rule,
                    )
                assert incident.identifier == kwargs["identifier"]
                create_method(*args, **kwargs)
                self.fail("Expected an integrity error")
            else:
                call_count[0] += 1

            return create_method(*args, **kwargs)

        self.organization
        with patch.object(BaseManager, "create", new=mock_base_create):
            incident = Incident.objects.create(
                self.organization,
                alert_rule=alert_rule,
                status=IncidentStatus.OPEN.value,
                title="hi",
                type=IncidentType.ALERT_TRIGGERED.value,
            )
            # We should have 3 calls - one for initial create, one for conflict,
            # then the final one for the retry we get due to the conflict
            assert call_count[0] == 3
            # Ideally this would be 2, but because we create the conflicting
            # row inside of a transaction it ends up rolled back. We just want
            # to verify that it was created successfully.
            assert incident.identifier == 1


@freeze_time()
class IncidentDurationTest(unittest.TestCase):
    def test(self) -> None:
        incident = Incident(date_started=timezone.now() - timedelta(minutes=5))
        assert incident.duration == timedelta(minutes=5)
        incident.date_closed = incident.date_started + timedelta(minutes=2)
        assert incident.duration == timedelta(minutes=2)


@freeze_time()
class IncidentCurrentEndDateTest(unittest.TestCase):
    def test(self) -> None:
        incident = Incident()
        assert incident.current_end_date == timezone.now()
        incident.date_closed = timezone.now() - timedelta(minutes=10)
        assert incident.current_end_date == timezone.now() - timedelta(minutes=10)
