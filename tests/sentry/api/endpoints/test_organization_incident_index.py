from __future__ import absolute_import

from django.utils import timezone
from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.models import Incident, IncidentStatus, IncidentActivity
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
        other_incident = self.create_incident(status=IncidentStatus.CLOSED.value)

        self.login_as(self.user)
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == serialize([other_incident, incident])

    def test_filter_status(self):
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        closed_incident = self.create_incident(status=IncidentStatus.CLOSED.value)
        self.login_as(self.user)

        with self.feature('organizations:incidents'):
            resp_closed = self.get_valid_response(
                self.organization.slug, status='closed',
            )
            resp_open = self.get_valid_response(
                self.organization.slug, status='open'
            )

        assert len(resp_closed.data) == 1
        assert len(resp_open.data) == 1
        assert resp_closed.data == serialize([closed_incident])
        assert resp_open.data == serialize([incident])

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

        # should create an activity authored by user
        activity = IncidentActivity.objects.get(incident_id=resp.data['id'])
        assert activity.user == self.user

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
