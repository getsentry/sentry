from __future__ import absolute_import

from exam import fixture

from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
)
from sentry.testutils import APITestCase


class OrganizationIncidentCommentDetailBase(APITestCase):
    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()


class OrganizationIncidentCommentUpdateEndpointTest(OrganizationIncidentCommentDetailBase):
    endpoint = 'sentry-api-0-organization-incident-comment-details'
    method = 'put'

    def test_simple(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        comment = 'hello'
        self.incident = self.create_incident()
        activity = self.create_incident_comment(self.incident, user=self.user)
        with self.feature('organizations:incidents'):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                activity.id,
                comment=comment,
                status_code=200,
            )
        activity = IncidentActivity.objects.get(id=activity.id)
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user

    def test_not_found(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        comment = 'hello'
        self.incident = self.create_incident()
        self.create_incident_comment(self.incident, user=self.user)
        with self.feature('organizations:incidents'):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                123,
                comment=comment,
                status_code=404,
            )


class OrganizationIncidentCommentDeleteEndpointTest(OrganizationIncidentCommentDetailBase):
    endpoint = 'sentry-api-0-organization-incident-comment-details'
    method = 'delete'

    def test_simple(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.incident = self.create_incident()
        activity = self.create_incident_comment(self.incident, user=self.user)
        with self.feature('organizations:incidents'):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                activity.id,
                status_code=204,
            )
        assert not IncidentActivity.objects.filter(id=activity.id).exists()

    def test_not_found(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        comment = 'hello'
        self.incident = self.create_incident()
        self.create_incident_comment(self.incident, user=self.user)
        with self.feature('organizations:incidents'):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                123,
                comment=comment,
                status_code=404,
            )
