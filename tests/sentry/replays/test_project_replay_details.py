from django.urls import reverse

from sentry.testutils import APITestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationReplayDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-replay-details"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug, 1))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404
