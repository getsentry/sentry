from __future__ import absolute_import

from sentry.incidents.models import Incident
from sentry.testutils import TestCase


class FetchForOrganizationTest(TestCase):
    def test_empty(self):
        incidents = Incident.objects.fetch_for_organization(
            self.organization,
            [self.project],
        )
        assert [] == list(incidents)
        self.create_project()

    def test_simple(self):
        incident = self.create_incident()

        assert [incident] == list(Incident.objects.fetch_for_organization(
            self.organization,
            [self.project],
        ))

    def test_invalid_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project])

        assert [] == list(Incident.objects.fetch_for_organization(
            self.organization,
            [self.project],
        ))
        assert [incident] == list(Incident.objects.fetch_for_organization(
            self.organization,
            [project],
        ))

    def test_multi_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project, self.project])

        assert [incident] == list(Incident.objects.fetch_for_organization(
            self.organization,
            [self.project],
        ))
        assert [incident] == list(Incident.objects.fetch_for_organization(
            self.organization,
            [project],
        ))
