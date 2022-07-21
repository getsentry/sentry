import datetime
import typing
import uuid

from django.urls import reverse

from sentry.testutils import APITestCase, ReplaysSnubaTestCase
from tests.sentry.replays import utils

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationReplayDetailsTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details"

    def setUp(self):
        self.login_as(user=self.user)
        self.replay_id = uuid.uuid4()
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_replay_found(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_get_replay(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=6)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=3)
        seq3_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=1)

        replay_id = str(self.replay_id)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id))
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, str(uuid.uuid4())))
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                self.project.id,
                replay_id,
                sequence_id=1,
                trace_ids=["2a0dcb0e-a1fb-4350-b266-47ae1aa57dfb"],
            )
        )
        self.store_replays(
            mock_replay(
                seq3_timestamp, self.project.id, replay_id, sequence_id=2, sdk_version="16.8.2"
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data

            expected_response = {
                "replay_id": replay_id,
                "title": "",  # NOT WRITTEN
                "platform": "javascript",
                "environment": "",  # NOT WRITTEN
                "release": "",  # NOT WRITTEN
                "dist": "abc123",
                "ip_address_v4": "127.0.0.1",
                "ip_address_v6": "::",
                "user": "",
                "user_id": "123",
                "user_email": "username@example.com",
                "user_hash": 0,  # NOT WRITTEN
                "user_name": "username",
                "sdk_name": "sentry.javascript.react",
                "sdk_version": "16.8.2",
                "trace_ids": [
                    "ffb5344a-41dd-4b21-9288-187a2cd1ad6d",
                    "2a0dcb0e-a1fb-4350-b266-47ae1aa57dfb",
                ],
                "started_at": datetime.datetime.strftime(seq1_timestamp, "%Y-%m-%dT%H:%M:%S+00:00"),
                "finished_at": datetime.datetime.strftime(
                    seq3_timestamp, "%Y-%m-%dT%H:%M:%S+00:00"
                ),
                "duration": 5,
                "urls": ["", "", ""],  # WRONG.
                "count_urls": 3,  # WRONG.
                "count_sequences": 3,
                "tags": {
                    "isReplayRoot": "yes",
                    "skippedNormalization": "True",
                    "transaction": "/",
                },
                "count_errors": 0,
                "longest_transaction": 0,
            }

            utils.assert_expected_response(response_data["data"], expected_response)


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
            "environment": "production",
            "project_id": project_id,
            "release": "version@1.3",
            "dist": "abc123",
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
            "platform": "javascript",
            "version": "6.18.1",
            "type": "replay_event",
            "datetime": int(timestamp.timestamp()),
            "tags": [
                ["isReplayRoot", "yes"],
                ["skippedNormalization", "True"],
                ["transaction", "/"],
            ],
            "user": {
                "username": "username",
                "ip_address": "127.0.0.1",
                "id": "123",
                "email": "username@example.com",
                "hash": 123,
            },
            "title": "test",
        },
    }
