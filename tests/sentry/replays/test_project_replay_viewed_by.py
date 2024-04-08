import datetime
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.replays.testutils import assert_replay_ids_eq, mock_replay, mock_replay_viewed
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.utils import json

REPLAYS_FEATURES = {"organizations:session-replay": True}


class ProjectReplayViewedByTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-viewed-by"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_get_replay_viewed_by1(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        # mock views
        self.store_replays(
            mock_replay_viewed(
                seq2_timestamp.timestamp(), self.project.id, self.replay_id, self.user.id
            )
        )
        # self.store_replays(mock_replay_viewed(seq2_timestamp, self.project.id, self.replay_id, self.user.id))
        # self.store_replays(mock_replay_viewed(seq2_timestamp, self.project.id, self.replay_id, self.user.id))

        # check ids are returned in viewed_by and dedup
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            data = response.data["data"]
            assert_replay_ids_eq(data["id"], self.replay_id)
            assert len(data["viewed_by"]) == 1
            assert int(data["viewed_by"][0]["id"]) == self.user.id

    def test_get_replay_viewed_by_no_viewers(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert_replay_ids_eq(response.data["data"]["id"], self.replay_id)
            assert len(response.data["data"]["viewed_by"]) == 0

    def test_get_replay_viewed_by_not_found(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_get_replay_viewed_by_feature_flag_disabled(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        response = self.client.get(self.url)
        assert response.status_code == 404

    @patch("sentry.replays.endpoints.project_replay_viewed_by.publish_replay_event")
    def test_post_replay_viewed_by(self, publish_replay_event):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.post(self.url, data="")
            assert response.status_code == 204
            assert publish_replay_event.called

            replay_event = json.loads(publish_replay_event.call_args[0][0])
            payload = json.loads(bytes(replay_event["payload"]))
            assert payload["type"] == "replay_viewed"
