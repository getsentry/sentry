import datetime

from django.urls import reverse

from sentry.replays.testutils import assert_expected_response, mock_expected_response, mock_replay
from sentry.testutils import APITestCase, ReplaysSnubaTestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationReplayIndexTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-organization-replay-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_projects(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"] == []

    def test_get_replays(self):
        project = self.create_project(teams=[self.team])

        replay1_id = "44c586f7-bd12-4c1b-b609-189344a19e92"
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            # Assert the response body matches what was expected.
            expected_response = mock_expected_response(
                replay1_id, seq1_timestamp, seq2_timestamp, urls=["", ""], count_sequences=2
            )
            assert_expected_response(response_data["data"][0], expected_response)

    def test_get_replays_start_at_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)

        replay1_id = "44c586f7-bd12-4c1b-b609-189344a19e92"
        replay2_id = "6f959c5c-bc77-4683-8723-6e3367b0cfac"

        self.store_replays(mock_replay(replay1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Default latest first.
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 2

            assert response_data["data"][0]["replay_id"] == replay2_id
            assert response_data["data"][1]["replay_id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=started-at")
            response_data = response.json()
            assert response_data["data"][0]["replay_id"] == replay1_id
            assert response_data["data"][1]["replay_id"] == replay2_id

            # Latest first.
            response = self.client.get(self.url + "?sort=-started-at")
            response_data = response.json()
            assert response_data["data"][0]["replay_id"] == replay2_id
            assert response_data["data"][1]["replay_id"] == replay1_id

    def test_get_replays_duration_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        replay1_id = "44c586f7-bd12-4c1b-b609-189344a19e92"
        replay2_id = "6f959c5c-bc77-4683-8723-6e3367b0cfac"

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Smallest duration first.
            response = self.client.get(self.url + "?sort=duration")
            response_data = response.json()
            assert response_data["data"][0]["replay_id"] == replay1_id
            assert response_data["data"][1]["replay_id"] == replay2_id

            # Largest duration first.
            response = self.client.get(self.url + "?sort=-duration")
            response_data = response.json()
            assert response_data["data"][0]["replay_id"] == replay2_id
            assert response_data["data"][1]["replay_id"] == replay1_id

    def test_get_replays_pagination(self):
        project = self.create_project(teams=[self.team])

        replay1_id = "44c586f7-bd12-4c1b-b609-189344a19e92"
        replay2_id = "6f959c5c-bc77-4683-8723-6e3367b0cfac"
        replay1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        self.store_replays(mock_replay(replay1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # First page.
            response = self.client.get(self.url + "?limit=1")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["replay_id"] == replay2_id

            # Next page.
            response = self.client.get(self.url + "?limit=1&offset=1")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["replay_id"] == replay1_id

            # Beyond pages.
            response = self.client.get(self.url + "?limit=1&offset=2")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0
