import datetime
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.silo import region_silo_test

REPLAYS_FEATURES = {
    "organizations:session-replay": True,
    "organizations:session-replay-accessibility-issues": True,
}


@region_silo_test
class OrganizationReplayDetailsTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-accessibility-issues"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_invalid_uuid_404s(self):
        with self.feature(REPLAYS_FEATURES):
            url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug, "abc"))
            response = self.client.get(url)
            assert response.status_code == 404

    @patch(
        "sentry.replays.endpoints.project_replay_accessibility_issues.request_accessibility_issues"
    )
    def test_get_replay_accessibility_issues(self, request_accessibility_issues):
        request_accessibility_issues.return_value = {
            "meta": {"total": 1},
            "data": [
                {
                    "elements": [
                        {
                            "alternatives": [{"id": "button-has-visible-text", "message": "m"}],
                            "element": '<button class="svelte-19ke1iv">',
                            "target": ["button:nth-child(1)"],
                        }
                    ],
                    "help_url": "url",
                    "help": "Buttons must have discernible text",
                    "id": "button-name",
                    "impact": "critical",
                    "timestamp": 1695967678108,
                }
            ],
        }

        replay_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id, segment_id=0))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)

            assert response.status_code == 200
            assert response.has_header("X-Hits")
            assert request_accessibility_issues.called

            response_data = response.json()
            assert len(response_data["data"]) == 1
            assert "elements" in response_data["data"][0]
            assert "help_url" in response_data["data"][0]
            assert "help" in response_data["data"][0]
            assert "id" in response_data["data"][0]
            assert "impact" in response_data["data"][0]
            assert "timestamp" in response_data["data"][0]
            assert len(response_data["data"][0]["elements"]) == 1
            assert "alternatives" in response_data["data"][0]["elements"][0]
            assert "element" in response_data["data"][0]["elements"][0]
            assert "target" in response_data["data"][0]["elements"][0]

    @patch(
        "sentry.replays.endpoints.project_replay_accessibility_issues.request_accessibility_issues"
    )
    def test_get_replay_accessibility_issues_by_timestamp(self, request_accessibility_issues):
        request_accessibility_issues.return_value = {
            "meta": {"total": 1},
            "data": [
                {
                    "elements": [
                        {
                            "alternatives": [{"id": "button-has-visible-text", "message": "m"}],
                            "element": '<button class="svelte-19ke1iv">',
                            "target": ["button:nth-child(1)"],
                        }
                    ],
                    "help_url": "url",
                    "help": "Buttons must have discernible text",
                    "id": "button-name",
                    "impact": "critical",
                    "timestamp": 1695967678108,
                }
            ],
        }

        replay_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id, segment_id=0))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            # Query at a time interval which returns both segments.
            response = self.client.get(self.url + f"?timestamp={int(seq2_timestamp.timestamp())}")
            assert request_accessibility_issues.called
            assert len(request_accessibility_issues.call_args[0][0]) == 2
            assert response.status_code == 200

    @patch(
        "sentry.replays.endpoints.project_replay_accessibility_issues.request_accessibility_issues"
    )
    def test_get_replay_accessibility_issues_by_timestamp_reduced_set(
        self, request_accessibility_issues
    ):
        request_accessibility_issues.return_value = {
            "meta": {"total": 1},
            "data": [
                {
                    "elements": [
                        {
                            "alternatives": [{"id": "button-has-visible-text", "message": "m"}],
                            "element": '<button class="svelte-19ke1iv">',
                            "target": ["button:nth-child(1)"],
                        }
                    ],
                    "help_url": "url",
                    "help": "Buttons must have discernible text",
                    "id": "button-name",
                    "impact": "critical",
                    "timestamp": 1695967678108,
                }
            ],
        }

        replay_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id, segment_id=0))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            # Query at a time interval which returns only the first segment.
            response = self.client.get(self.url + f"?timestamp={seq2_timestamp.timestamp() - 1}")
            assert request_accessibility_issues.called
            assert len(request_accessibility_issues.call_args[0][0]) == 1
            assert response.status_code == 200

    @patch(
        "sentry.replays.endpoints.project_replay_accessibility_issues.request_accessibility_issues"
    )
    def test_get_replay_accessibility_issues_by_timestamp_nothing_found(
        self, request_accessibility_issues
    ):
        request_accessibility_issues.return_value = {
            "meta": {"total": 1},
            "data": [
                {
                    "elements": [
                        {
                            "alternatives": [{"id": "button-has-visible-text", "message": "m"}],
                            "element": '<button class="svelte-19ke1iv">',
                            "target": ["button:nth-child(1)"],
                        }
                    ],
                    "help_url": "url",
                    "help": "Buttons must have discernible text",
                    "id": "button-name",
                    "impact": "critical",
                    "timestamp": 1695967678108,
                }
            ],
        }

        replay_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id, segment_id=0))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?timestamp=0")
            assert not request_accessibility_issues.called
            assert response.status_code == 200
