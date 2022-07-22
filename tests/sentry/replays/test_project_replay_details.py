import datetime
import uuid

from django.urls import reverse

from sentry.replays.testutils import assert_expected_response, mock_expected_response, mock_replay
from sentry.testutils import APITestCase, ReplaysSnubaTestCase

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
        replay_id = str(self.replay_id)
        non_returned_replay_id = str(uuid.uuid4())
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=6)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=3)
        seq3_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=1)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, non_returned_replay_id))
        self.store_replays(mock_replay(seq3_timestamp, self.project.id, non_returned_replay_id))

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay_id,
                trace_ids=["ffb5344a-41dd-4b21-9288-187a2cd1ad6d"],
            )
        )
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

            expected_response = mock_expected_response(
                replay_id,
                seq1_timestamp,
                seq3_timestamp,
                sdk_version="16.8.2",
                trace_ids=[
                    "ffb5344a-41dd-4b21-9288-187a2cd1ad6d",
                    "2a0dcb0e-a1fb-4350-b266-47ae1aa57dfb",
                ],
                urls=["", "", ""],
                count_sequences=3,
            )
            assert_expected_response(response_data["data"], expected_response)
