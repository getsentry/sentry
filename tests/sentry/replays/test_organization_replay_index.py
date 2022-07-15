from django.urls import reverse

from sentry.testutils import APITestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationReplayIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-replay-index"

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_projects(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == []
