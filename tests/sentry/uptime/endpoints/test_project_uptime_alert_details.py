import pytest
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.uptime.models import ProjectUptimeSubscription


class ProjectUptimeAlertDetailsBaseEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-uptime-alert-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


class ProjectUptimeAlertDetailsGetEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    def test_simple(self):
        uptime_subscription = self.create_project_uptime_subscription()

        resp = self.get_success_response(
            self.organization.slug, uptime_subscription.project.slug, uptime_subscription.id
        )
        assert resp.data == serialize(uptime_subscription, self.user)

    def test_not_found(self):
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404


class ProjectUptimeAlertDetailsPutEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    method = "put"

    def test_user(self):
        uptime_subscription = self.create_project_uptime_subscription()

        resp = self.get_success_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            name="test",
            owner=f"user:{self.user.id}",
        )
        uptime_subscription.refresh_from_db()
        assert resp.data == serialize(uptime_subscription, self.user)
        assert uptime_subscription.name == "test"
        assert uptime_subscription.owner_user_id == self.user.id
        assert uptime_subscription.owner_team_id is None

    def test_team(self):
        uptime_subscription = self.create_project_uptime_subscription()
        resp = self.get_success_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            name="test_2",
            owner=f"team:{self.team.id}",
        )
        uptime_subscription.refresh_from_db()
        assert resp.data == serialize(uptime_subscription, self.user)
        assert uptime_subscription.name == "test_2"
        assert uptime_subscription.owner_user_id is None
        assert uptime_subscription.owner_team_id == self.team.id

    def test_invalid_owner(self):
        uptime_subscription = self.create_project_uptime_subscription()
        bad_user = self.create_user()

        resp = self.get_error_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            owner=f"user:{bad_user.id}",
        )
        assert resp.data == {
            "owner": [
                ErrorDetail(string="User is not a member of this organization", code="invalid")
            ]
        }

        bad_team = self.create_team(organization=self.create_organization())

        resp = self.get_error_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            owner=f"team:{bad_team.id}",
        )
        assert resp.data == {
            "owner": [
                ErrorDetail(string="Team is not a member of this organization", code="invalid")
            ]
        }

    def test_not_found(self):
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404


class ProjectUptimeAlertDetailsDeleteEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    method = "delete"

    def test_user(self):
        uptime_subscription = self.create_project_uptime_subscription()

        self.get_success_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            status_code=202,
        )
        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            uptime_subscription.refresh_from_db()

    def test_not_found(self):
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404
