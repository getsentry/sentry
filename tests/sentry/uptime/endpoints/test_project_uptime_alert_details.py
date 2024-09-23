from unittest import mock

import pytest
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers import serialize
from sentry.uptime.models import ProjectUptimeSubscription
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class ProjectUptimeAlertDetailsBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-project-uptime-alert-details"


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

    @mock.patch("sentry.uptime.endpoints.validators.MAX_MONITORS_PER_DOMAIN", 1)
    def test_domain_limit(self):
        # First monitor is for test-one.example.com
        self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(
                url="test-one.example.com",
                url_domain="example",
                url_domain_suffix="com",
            )
        )

        # Update second monitor to use the same domain. This will fail with a
        # validation error
        uptime_subscription = self.create_project_uptime_subscription()
        resp = self.get_error_response(
            self.organization.slug,
            uptime_subscription.project.slug,
            uptime_subscription.id,
            status_code=400,
            url="https://test-two.example.com",
        )
        assert (
            resp.data["url"][0]
            == "The domain *.example.com has already been used in 1 uptime monitoring alerts, which is the limit. You cannot create any additional alerts for this domain."
        )


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
