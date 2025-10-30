import datetime
from uuid import uuid4

from django.urls import reverse

from sentry.replays.testutils import assert_expected_response, mock_expected_response, mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationReplayDetailsTest(APITestCase, ReplaysSnubaTestCase):
    def test_query_replay_instance_eap_calls_eap_query(self) -> None:
        """Ensure query_replay_instance_eap calls eap_read.query with correct arguments."""
        import datetime
        from unittest.mock import patch

        from sentry.replays.endpoints.organization_replay_details import query_replay_instance_eap

        project_ids = [123]
        replay_id = "abc123"
        start = datetime.datetime(2025, 1, 1, 0, 0, tzinfo=datetime.UTC)
        end = datetime.datetime(2025, 1, 2, 0, 0, tzinfo=datetime.UTC)
        organization_id = 42
        referrer = "test.referrer"

        with patch("sentry.replays.lib.eap.read.query") as mock_query:
            mock_query.return_value = "mocked"
            result = query_replay_instance_eap(
                project_ids=project_ids,
                replay_id=replay_id,
                start=start,
                end=end,
                organization_id=organization_id,
                referrer=referrer,
            )
            assert result == "mocked"
            assert mock_query.call_count == 1

            args, kwargs = mock_query.call_args
            snuba_query = args[0]
            assert snuba_query.match.name == "replays"

            select_cols = [col.name for col in snuba_query.select]
            assert "replay_id" in select_cols
            assert "project_id" in select_cols
            assert "timestamp" in select_cols
            assert "segment_id" in select_cols
            assert "is_archived" in select_cols

            settings = args[1]
            assert settings["attribute_types"]["replay_id"] == str
            assert settings["attribute_types"]["project_id"] == int
            assert settings["attribute_types"]["timestamp"] == int
            assert settings["attribute_types"]["segment_id"] == int
            assert settings["attribute_types"]["is_archived"] == int
            assert settings["default_limit"] == 1
            assert settings["default_offset"] == 0

            request_meta = args[2]
            assert request_meta["organization_id"] == organization_id
            assert request_meta["project_ids"] == project_ids
            assert request_meta["referrer"] == referrer
            assert request_meta["cogs_category"] == "replays"
            assert request_meta["trace_item_type"] == "replay"

    endpoint = "sentry-api-0-organization-replay-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid4().hex
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.replay_id))

    def test_feature_flag_disabled(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_replay_found(self) -> None:
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_no_projects(self) -> None:
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_project_no_permissions(self) -> None:
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, self.replay_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, self.replay_id))

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        user = self.create_user(is_staff=False, is_superuser=False)
        member2 = self.create_member(organization=self.organization, user=user, role="member")

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            self.login_as(member2)
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_get_one_replay(self) -> None:
        """Test only one replay returned."""
        replay1_id = self.replay_id
        replay2_id = uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay2_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Replay 1.
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"]["id"] == replay1_id

            # Replay 2.
            response = self.client.get(
                reverse(self.endpoint, args=(self.organization.slug, replay2_id))
            )
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"]["id"] == replay2_id

    def test_get_replay_schema(self) -> None:
        """Test replay schema is well-formed."""
        replay1_id = self.replay_id
        replay2_id = uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=25)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=7)
        seq3_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=4)

        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex
        # Assert values from this non-returned replay do not pollute the returned
        # replay.
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay2_id))
        self.store_replays(mock_replay(seq3_timestamp, self.project.id, replay2_id))

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                trace_ids=[trace_id_1],
                urls=["http://localhost:3000/"],
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp,
                self.project.id,
                "error",
                replay1_id,
                "a3a62ef6ac86415b83c2416fc2f76db1",
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                segment_id=1,
                trace_ids=[trace_id_2],
                urls=["http://www.sentry.io/"],
                error_ids=[],
            )
        )
        self.store_replays(
            mock_replay(
                seq3_timestamp,
                self.project.id,
                replay1_id,
                segment_id=2,
                trace_ids=[trace_id_2],
                urls=["http://localhost:3000/"],
                error_ids=[],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data

            expected_response = mock_expected_response(
                self.project.id,
                replay1_id,
                seq1_timestamp,
                seq3_timestamp,
                trace_ids=[
                    trace_id_1,
                    trace_id_2,
                ],
                urls=[
                    "http://localhost:3000/",
                    "http://www.sentry.io/",
                    "http://localhost:3000/",
                ],
                count_segments=3,
                activity=4,
                count_errors=1,
            )
            assert_expected_response(response_data["data"], expected_response)

    def test_get_replay_varying_projects(self) -> None:
        """Test replay with varying project-ids returns its whole self."""
        project2 = self.create_project()

        replay1_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=25)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=7)
        seq3_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=4)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project2.id, replay1_id, segment_id=1))
        self.store_replays(mock_replay(seq3_timestamp, project2.id, replay1_id, segment_id=2))
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp,
                self.project.id,
                "error",
                replay1_id,
                "a3a62ef6ac86415b83c2416fc2f76db1",
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp,
                project2.id,
                "error",
                replay1_id,
                "e7052fca6e2e406b9dc2d6917932a4c9",
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data

            expected_response = mock_expected_response(
                self.project.id,
                replay1_id,
                seq1_timestamp,
                seq3_timestamp,
                count_segments=3,
                activity=5,
                error_ids=[
                    "a3a62ef6ac86415b83c2416fc2f76db1",
                    "e7052fca6e2e406b9dc2d6917932a4c9",
                ],
                # Assert two errors returned even though one was on a different
                # project.
                count_errors=2,
            )
            assert_expected_response(response_data["data"], expected_response)
