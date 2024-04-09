import datetime
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.replays.testutils import (
    assert_viewed_by_expected_ids_and_unique,
    mock_replay,
    mock_replay_viewed,
)
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

    def test_get_replay_viewed_by(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        seq3_timestamp = datetime.datetime.now()
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        # 2 views by same user (should be dedup'd)
        self.store_replays(
            mock_replay_viewed(
                seq2_timestamp.timestamp(),
                self.project.id,
                self.replay_id,
                self.user.id,
            )
        )
        self.store_replays(
            mock_replay_viewed(
                seq3_timestamp.timestamp(), self.project.id, self.replay_id, self.user.id
            )
        )

        # second user
        other_user = self.create_user()
        self.store_replays(
            mock_replay_viewed(
                seq3_timestamp.timestamp(), self.project.id, self.replay_id, other_user.id
            )
        )

        # nonexistent user (shouldn't show up in response)
        self.store_replays(
            mock_replay_viewed(
                seq2_timestamp.timestamp(),
                self.project.id,
                self.replay_id,
                2387562378,
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            # note the list of users is unordered
            assert_viewed_by_expected_ids_and_unique(
                response.data["data"]["viewed_by"], {self.user.id, other_user.id}
            )

    def test_get_replay_viewed_by_user_fields(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        self.store_replays(
            mock_replay_viewed(
                seq2_timestamp.timestamp(), self.project.id, self.replay_id, self.user.id
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            assert response.status_code == 200
            assert_viewed_by_expected_ids_and_unique(
                response.data["data"]["viewed_by"], {self.user.id}
            )

            # user fields
            user_dict = response.data["data"]["viewed_by"][0]
            assert user_dict["username"] == self.user.username
            assert user_dict["email"] == self.user.email
            assert user_dict["isActive"] == self.user.is_active
            assert user_dict["isManaged"] == self.user.is_managed
            assert user_dict["dateJoined"] == self.user.date_joined
            assert user_dict["lastActive"] == self.user.last_active
            assert user_dict["isSuperuser"] == self.user.is_superuser
            assert user_dict["isStaff"] == self.user.is_staff
            # excluded fields: name, avatarUrl, hasPasswordAuth, isManaged,

    def test_get_replay_viewed_by_no_viewers(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
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
