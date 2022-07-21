import datetime

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
        timestamp = datetime.datetime.now() - datetime.timedelta(minutes=5)
        replay_id = "44c586f7-bd12-4c1b-b609-189344a19e92"

        project = self.create_project(teams=[self.team])

        self.store_replays(
            {
                "datetime": int(timestamp.timestamp()),
                "platform": "javascript",
                "project_id": project.id,
                "replay_id": replay_id,
                "retention_days": 20,
                "sequence_id": 0,
                "trace_ids": ["ffb5344a-41dd-4b21-9288-187a2cd1ad6d"],
                "data": {
                    "timestamp": int(timestamp.timestamp()),
                    "replay_id": replay_id,
                    "environment": "production",
                    "project_id": project.id,
                    "sdk": {
                        "name": "sentry.javascript.react",
                        "version": "6.18.1",
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
                    "title": "test",
                },
            }
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            expected_response = {
                "replay_id": replay_id,
                "title": "",
                "platform": "javascript",
                "environment": "",
                "release": "",
                "dist": "",
                "ip_address_v4": "0.0.0.0",
                "ip_address_v6": "::",
                "user": "",
                "user_id": "",
                "user_email": "",
                "user_hash": 0,
                "user_name": "",
                "sdk_name": "sentry.javascript.react",
                "sdk_version": "6.18.1",
                "trace_ids": ["ffb5344a-41dd-4b21-9288-187a2cd1ad6d"],
                "started_at": datetime.datetime.strftime(timestamp, "%Y-%m-%dT%H:%M:%S+00:00"),
                "finished_at": datetime.datetime.strftime(timestamp, "%Y-%m-%dT%H:%M:%S+00:00"),
                "duration": 0,
                "urls": [""],
                "count_urls": 1,
                "count_sequences": 1,
                "tags": {"isReplayRoot": "yes", "skippedNormalization": "True", "transaction": "/"},
                "count_errors": 0,
                "longest_transaction": 0,
            }

            utils.assert_expected_response(response_data["data"][0], expected_response)
