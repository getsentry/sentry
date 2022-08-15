import datetime
import uuid

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
        """Test replays can be disabled."""
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_projects(self):
        """Test replays must be used with a project(s)."""
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"] == []

    def test_get_replays(self):
        """Test replays conform to the interchange format."""
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay1_id,
                # NOTE: This is commented out due to a bug in CI.  This will not affect
                # production use and have been verfied as working as of 08/10/2022.
                #
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],  # duplicate urls are okay
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=["http://localhost:3000/"],  # duplicate urls are okay
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            # Assert the response body matches what was expected.
            expected_response = mock_expected_response(
                project.id,
                replay1_id,
                seq1_timestamp,
                seq2_timestamp,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                    "http://localhost:3000/",
                ],
                count_segments=2,
                # count_errors=3,
                count_errors=0,
            )
            assert_expected_response(response_data["data"][0], expected_response)

    def test_get_replays_require_duration(self):
        """Test returned replays must have a substantive duration."""
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=6)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

    def test_get_replays_require_timely_initial_sequence(self):
        """Test returned replays can not partially fall outside of range."""
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(days=365)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0

    def test_get_replays_filter_environment(self):
        """Test returned replays can not partially fall outside of range."""
        project = self.create_project(teams=[self.team])

        self.create_environment(name="development", project=self.project)
        self.create_environment(name="production", project=self.project)

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=20)
        timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)

        self.store_replays(
            mock_replay(timestamp0, project.id, replay1_id, environment="development")
        )
        self.store_replays(
            mock_replay(timestamp1, project.id, replay1_id, environment="development")
        )
        self.store_replays(
            mock_replay(timestamp0, project.id, replay2_id, environment="production")
        )
        self.store_replays(
            mock_replay(timestamp1, project.id, replay2_id, environment="production")
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?environment=development")
            assert response.status_code == 200
            print(response.content.decode("utf-8"))

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"][0]["id"] == replay1_id

            response = self.client.get(self.url + "?environment=production")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"][0]["id"] == replay2_id

    def test_get_replays_started_at_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Latest first.
            response = self.client.get(self.url + "?sort=-startedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=startedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

    def test_get_replays_finished_at_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Latest first.
            response = self.client.get(self.url + "?sort=-finishedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=finishedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

    def test_get_replays_duration_sorted(self):
        """Test replays can be sorted by duration."""
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=9)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Smallest duration first.
            response = self.client.get(self.url + "?sort=duration")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

            # Largest duration first.
            response = self.client.get(self.url + "?sort=-duration")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

    def test_get_replays_pagination(self):
        """Test replays can be paginated."""
        project = self.create_project(teams=[self.team])

        replay1_id = str(uuid.uuid4())
        replay2_id = str(uuid.uuid4())
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # First page.
            response = self.client.get(self.url + "?limit=1")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["id"] == replay2_id

            # Next page.
            response = self.client.get(self.url + "?limit=1&offset=1")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["id"] == replay1_id

            # Beyond pages.
            response = self.client.get(self.url + "?limit=1&offset=2")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0
