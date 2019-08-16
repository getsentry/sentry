from __future__ import absolute_import

from exam import fixture

from sentry.incidents.models import IncidentActivity, IncidentActivityType
from sentry.testutils import APITestCase


class BaseIncidentCommentDetailsTest(object):
    endpoint = "sentry-api-0-organization-incident-comment-details"

    def setUp(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        self.activity = self.create_incident_comment(self.incident, user=self.user)
        self.detected_activity = self.create_incident_activity(
            self.incident, user=self.user, type=IncidentActivityType.DETECTED.value
        )

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    @fixture
    def incident(self):
        return self.create_incident()

    def test_not_found(self):
        comment = "hello"
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                123,
                comment=comment,
                status_code=404,
            )

    def test_non_comment_type(self):
        comment = "hello"
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                self.detected_activity.id,
                comment=comment,
                status_code=404,
            )


class OrganizationIncidentCommentUpdateEndpointTest(BaseIncidentCommentDetailsTest, APITestCase):
    method = "put"

    def test_simple(self):
        comment = "hello"
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug,
                self.incident.identifier,
                self.activity.id,
                comment=comment,
                status_code=200,
            )
        activity = IncidentActivity.objects.get(id=self.activity.id)
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user
        assert activity.comment == comment


class OrganizationIncidentCommentDeleteEndpointTest(BaseIncidentCommentDetailsTest, APITestCase):
    method = "delete"

    def test_simple(self):
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, self.incident.identifier, self.activity.id, status_code=204
            )
        assert not IncidentActivity.objects.filter(id=self.activity.id).exists()
