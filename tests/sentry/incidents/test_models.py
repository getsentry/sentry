from __future__ import absolute_import

import unittest
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from freezegun import freeze_time
from mock import patch

from sentry.db.models.manager import BaseManager
from sentry.incidents.models import Incident, IncidentStatus
from sentry.testutils import TestCase


class FetchForOrganizationTest(TestCase):
    def test_empty(self):
        incidents = Incident.objects.fetch_for_organization(self.organization, [self.project])
        assert [] == list(incidents)
        self.create_project()

    def test_simple(self):
        incident = self.create_incident()

        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )

    def test_invalid_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project])

        assert [] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [project])
        )

    def test_multi_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project, self.project])

        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project, project])
        )


class IncidentCreationTest(TestCase):
    def test_simple(self):
        title = "hello"
        query = "goodbye"
        incident = Incident.objects.create(self.organization, title=title, query=query)
        assert incident.identifier == 1
        assert incident.title == title
        assert incident.query == query

        # Check identifier correctly increments
        incident = Incident.objects.create(self.organization, title=title, query=query)
        assert incident.identifier == 2

    def test_identifier_conflict(self):
        create_method = BaseManager.create
        call_count = [0]

        def mock_base_create(*args, **kwargs):
            if not call_count[0]:
                call_count[0] += 1
                # This incident will take the identifier we already fetched and
                # use it, which will cause the database to throw an integrity
                # error.
                with transaction.atomic():
                    incident = Incident.objects.create(
                        self.organization,
                        status=IncidentStatus.OPEN.value,
                        title="Conflicting Incident",
                        query="Uh oh",
                    )
                assert incident.identifier == kwargs["identifier"]
                try:
                    create_method(*args, **kwargs)
                except IntegrityError:
                    raise
                else:
                    self.fail("Expected an integrity error")
            else:
                call_count[0] += 1

            return create_method(*args, **kwargs)

        self.organization
        with patch.object(BaseManager, "create", new=mock_base_create):
            incident = Incident.objects.create(
                self.organization, status=IncidentStatus.OPEN.value, title="hi", query="bye"
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
    def test(self):
        incident = Incident(date_started=timezone.now() - timedelta(minutes=5))
        assert incident.duration == timedelta(minutes=5)
        incident.date_closed = incident.date_started + timedelta(minutes=2)
        assert incident.duration == timedelta(minutes=2)


@freeze_time()
class IncidentCurrentEndDateTest(unittest.TestCase):
    def test(self):
        incident = Incident()
        assert incident.current_end_date == timezone.now()
        incident.date_closed = timezone.now() - timedelta(minutes=10)
        assert incident.current_end_date == timezone.now() - timedelta(minutes=10)
