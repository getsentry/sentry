import datetime
import time
from unittest.mock import patch
from uuid import uuid4

import dateutil.parser
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
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        self.store_replays(
            mock_replay_viewed(time.time(), self.project.id, self.replay_id, self.user.id)
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            assert response.status_code == 200
            assert_viewed_by_expected_ids_and_unique(
                response.data["data"]["viewed_by"], {self.user.id}
            )

            # Assert the viewed_by_user value matches the blueprint.
            viewed_by_user = response.data["data"]["viewed_by"][0]
            assert len(viewed_by_user) == 18
            assert "avatarUrl" in viewed_by_user
            assert "dateJoined" in viewed_by_user
            assert "email" in viewed_by_user
            assert "experiments" in viewed_by_user
            assert "has2fa" in viewed_by_user
            assert "hasPasswordAuth" in viewed_by_user
            assert "id" in viewed_by_user
            assert "isActive" in viewed_by_user
            assert "isManaged" in viewed_by_user
            assert "isStaff" in viewed_by_user
            assert "isSuperuser" in viewed_by_user
            assert "lastActive" in viewed_by_user
            assert "lastLogin" in viewed_by_user
            assert "name" in viewed_by_user
            assert "type" in viewed_by_user
            assert "username" in viewed_by_user

            assert "avatar" in viewed_by_user
            assert isinstance(viewed_by_user["avatar"], dict)
            assert "avatarType" in viewed_by_user["avatar"]
            assert "avatarUuid" in viewed_by_user["avatar"]
            assert "avatarUrl" in viewed_by_user["avatar"]

            assert "emails" in viewed_by_user
            assert isinstance(viewed_by_user["emails"], list)
            assert "id" in viewed_by_user["emails"][0]
            assert "email" in viewed_by_user["emails"][0]
            assert "is_verified" in viewed_by_user["emails"][0]

            # Assert the returned user is the viewed-by user.
            assert viewed_by_user["type"] == "user"
            assert viewed_by_user["username"] == self.user.username
            assert viewed_by_user["email"] == self.user.email
            assert viewed_by_user["isActive"] == self.user.is_active
            assert viewed_by_user["isManaged"] == self.user.is_managed
            assert dateutil.parser.parse(viewed_by_user["dateJoined"]) == self.user.date_joined
            assert dateutil.parser.parse(viewed_by_user["lastActive"]) == self.user.last_active
            assert viewed_by_user["isSuperuser"] == self.user.is_superuser
            assert viewed_by_user["isStaff"] == self.user.is_staff

    def test_get_replay_viewed_by_nonexistent_user(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        # Nonexistent users do not show up in response).
        self.store_replays(
            mock_replay_viewed(time.time(), self.project.id, self.replay_id, 2387562378)
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert len(response.data["data"]["viewed_by"]) == 0

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
            finished_at_dt = datetime.datetime.now() - datetime.timedelta(seconds=20)
            self.store_replays(mock_replay(finished_at_dt, self.project.id, self.replay_id))

            response = self.client.post(self.url, data="")
            assert response.status_code == 204
            assert publish_replay_event.called

            replay_event = json.loads(publish_replay_event.call_args[0][0])
            payload = json.loads(bytes(replay_event["payload"]))
            assert payload["type"] == "replay_viewed"
            assert payload["viewed_by_id"] == self.user.id
            assert isinstance(payload["timestamp"], float)

            # time should match the last replay segment with second-level precision
            assert int(payload["timestamp"]) == int(finished_at_dt.timestamp())

    def test_post_replay_viewed_by_not_exist(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.post(self.url, data="")
            assert response.status_code == 404

    @patch("sentry.replays.endpoints.project_replay_viewed_by.publish_replay_event")
    def test_post_replay_viewed_by_not_in_org(self, publish_replay_event):
        with self.feature(REPLAYS_FEATURES):
            finished_at_dt = datetime.datetime.now() - datetime.timedelta(seconds=20)
            self.store_replays(mock_replay(finished_at_dt, self.project.id, self.replay_id))
            self.login_as(user=self.create_user(is_superuser=True, is_staff=True), superuser=True)
            response = self.client.post(self.url, data="")
            assert response.status_code == 204
            assert not publish_replay_event.called

    def test_get_replay_viewed_by_user_in_other_org(self):
        other_org_member = self.create_member(
            organization=self.create_organization(), user=self.create_user()
        )
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        self.store_replays(
            mock_replay_viewed(
                time.time(), self.project.id, self.replay_id, other_org_member.user_id
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert len(response.data["data"]["viewed_by"]) == 0

    def test_get_replay_viewed_by_denylist(self):
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        self.store_replays(
            mock_replay_viewed(time.time(), self.project.id, self.replay_id, self.user.id)
        )

        with self.feature(REPLAYS_FEATURES):
            with self.options({"replay.viewed-by.project-denylist": [self.project.id]}):
                response = self.client.get(self.url)
                assert response.status_code == 400
                assert (
                    response.json()["detail"]["message"]
                    == "Viewed by search has been disabled for your project due to a data irregularity."
                )
