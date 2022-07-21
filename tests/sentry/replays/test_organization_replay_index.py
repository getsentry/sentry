import datetime
import typing

from django.urls import reverse

from sentry.testutils import APITestCase, ReplaysSnubaTestCase
from tests.sentry.replays import utils

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
            utils.assert_expected_response(response_data["data"][0], expected_response)

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


def mock_expected_response(
    replay_id: str,
    started_at: datetime.datetime,
    finished_at: datetime.datetime,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    urls = kwargs.pop("urls", [""])
    return {
        "replay_id": replay_id,
        "title": kwargs.pop("title", ""),
        "platform": kwargs.pop("platform", "javascript"),
        "environment": kwargs.pop("environment", ""),
        "release": kwargs.pop("release", ""),
        "dist": kwargs.pop("dist", "abc123"),
        "ip_address_v4": kwargs.pop("ip_address_v4", "127.0.0.1"),
        "ip_address_v6": kwargs.pop("ip_address_v6", "::"),
        "user": kwargs.pop("user", ""),
        "user_id": kwargs.pop("user_id", "123"),
        "user_email": kwargs.pop("user_email", "username@example.com"),
        "user_hash": kwargs.pop("user_hash", 0),
        "user_name": kwargs.pop("user_name", "username"),
        "sdk_name": kwargs.pop("sdk_name", "sentry.javascript.react"),
        "sdk_version": kwargs.pop("sdk_version", "6.18.1"),
        "trace_ids": kwargs.pop("trace_ids", ["ffb5344a-41dd-4b21-9288-187a2cd1ad6d"]),
        "started_at": datetime.datetime.strftime(started_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "finished_at": datetime.datetime.strftime(finished_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "duration": (finished_at - started_at).seconds,
        "urls": urls,
        "count_urls": len(urls),
        "count_sequences": kwargs.pop("count_sequences", 1),
        "tags": {"isReplayRoot": "yes", "skippedNormalization": "True", "transaction": "/"},
        "count_errors": kwargs.pop("count_errors", 0),
        "longest_transaction": kwargs.pop("longest_transaction", 0),
    }


def mock_replay(
    timestamp: datetime.datetime,
    project_id: str,
    replay_id: str,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    return {
        "datetime": int(timestamp.timestamp()),
        "platform": "javascript",
        "project_id": project_id,
        "replay_id": replay_id,
        "retention_days": 20,
        "sequence_id": kwargs.pop("sequence_id", 0),
        "trace_ids": kwargs.pop("trace_ids", ["ffb5344a-41dd-4b21-9288-187a2cd1ad6d"]),
        "data": {
            "timestamp": int(timestamp.timestamp()),
            "replay_id": replay_id,
            "environment": kwargs.pop("environment", "production"),
            "project_id": project_id,
            "release": kwargs.pop("release", "version@1.3"),
            "dist": kwargs.pop("dist", "abc123"),
            "sdk": {
                "name": kwargs.pop("sdk_name", "sentry.javascript.react"),
                "version": kwargs.pop("sdk_version", "6.18.1"),
                "integrations": [
                    "InboundFilters",
                    "FunctionToString",
                    "TryCatch",
                    "Breadcrumbs",
                    "GlobalHandlers",
                    "LinkedErrors",
                    "Dedupe",
                    "UserAgent",
                    "Replay",
                    "BrowserTracing",
                ],
                "packages": [{"name": "npm:@sentry/react", "version": "6.18.1"}],
            },
            "platform": kwargs.pop("platform", "javascript"),
            "version": "6.18.1",
            "type": "replay_event",
            "datetime": int(timestamp.timestamp()),
            "tags": [
                ["isReplayRoot", "yes"],
                ["skippedNormalization", "True"],
                ["transaction", "/"],
            ],
            "user": {
                "username": kwargs.pop("username", "username"),
                "ip_address": kwargs.pop("ip_address", "127.0.0.1"),
                "id": kwargs.pop("id", "123"),
                "email": kwargs.pop("email", "username@example.com"),
                "hash": kwargs.pop("hash", 123),
            },
            "title": kwargs.pop("title", "test"),
        },
    }
