from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
)
from sentry.testutils import APITestCase


class OrganizationIncidentCommentCreateEndpointTest(APITestCase):
    endpoint = 'sentry-api-0-organization-incident-comments'
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
        comment = 'hello'
        incident = self.create_incident()
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(
                self.organization.slug,
                incident.identifier,
                comment=comment,
                status_code=201,
            )
        activity = IncidentActivity.objects.get(id=resp.data['id'])
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user
        assert activity.comment == comment
        assert resp.data == serialize([activity])[0]

    def test_access(self):
        other_user = self.create_user()
        self.login_as(other_user)
        other_team = self.create_team()
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='member',
            teams=[self.team],
        )
        other_project = self.create_project(teams=[other_team])
        incident = self.create_incident(projects=[other_project])
        with self.feature('organizations:incidents'):
            resp = self.get_response(
                self.organization.slug,
                incident.identifier,
                comment='hi',
            )
            assert resp.status_code == 403
