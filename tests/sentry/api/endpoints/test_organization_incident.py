from __future__ import absolute_import

from django.utils import timezone
from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.models import Incident
from sentry.testutils import APITestCase


class IncidentListEndpointTest(APITestCase):
    endpoint = 'sentry-api-0-organization-incident-index'

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        self.login_as(self.user)
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(self.organization.slug)
        assert resp.data == serialize([incident])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404


@freeze_time()
class IncidentCreateEndpointTest(APITestCase):
    endpoint = 'sentry-api-0-organization-incident-index'
    method = 'post'

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(
                self.organization.slug,
                title='hello',
                query='hi',
                dateStarted=timezone.now(),
                projects=[self.project.slug],
                groups=[self.group.id],
                status_code=201,
            )
        assert resp.data == serialize([Incident.objects.get(id=resp.data['id'])])[0]

    def test_project_access(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

        other_org = self.create_organization(owner=self.create_user())
        other_project = self.create_project(organization=other_org, teams=[])
        with self.feature('organizations:incidents'):
            resp = self.get_response(
                other_org.slug,
                title='hello',
                query='hi',
                dateStarted=timezone.now(),
                projects=[other_project.slug],
                groups=[self.group.id],
            )
            assert resp.status_code == 403

    def test_group_access(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

        other_org = self.create_organization(owner=self.create_user())
        other_project = self.create_project(organization=other_org, teams=[])
        other_group = self.create_group(project=other_project)
        with self.feature('organizations:incidents'):
            resp = self.get_response(
                self.organization.slug,
                title='hello',
                query='hi',
                dateStarted=timezone.now(),
                groups=[self.group.id, other_group.id],
            )
            assert resp.status_code == 400, resp.content

    def test_no_feature(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404
