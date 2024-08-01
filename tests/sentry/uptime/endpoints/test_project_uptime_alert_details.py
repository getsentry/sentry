from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase


class ProjectUptimeAlertDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-uptime-alert-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        uptime_subscription = self.create_project_uptime_subscription()

        resp = self.get_success_response(
            self.organization.slug, uptime_subscription.project.slug, uptime_subscription.id
        )
        assert resp.data == serialize(uptime_subscription, self.user)

    def test_not_found(self):
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404
