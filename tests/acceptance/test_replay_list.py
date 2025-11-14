from typing import int
import uuid
from datetime import datetime, timedelta

from sentry.models.project import Project
from sentry.replays.testutils import mock_replay, mock_replay_viewed
from sentry.testutils.cases import ReplaysAcceptanceTestCase
from sentry.testutils.silo import no_silo_test

FEATURE_NAME = ["organizations:session-replay"]


@no_silo_test
class ReplayListTest(ReplaysAcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band 1")
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name="Bengal",
            flags=Project.flags.has_replays,
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/explore/replays/"

        self.header_fields = [
            "Replay",
            "OS",
            "Browser",
            "Duration",
            "Dead clicks",
            "Rage clicks",
            "Errors",
            "Activity",
        ]

    def assert_replay_table_renders(self) -> None:
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
        self.browser.wait_until_not('[data-test-id="replay-table-loading"]')
        assert not self.browser.element_exists_by_test_id("replay-table-errored")

    def test_empty(self) -> None:
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.assert_replay_table_renders()

            rows = self.browser.elements('[data-test-id="replay-table"] [role="row"]')
            assert len(rows) == 1

            for field in self.header_fields:
                assert field in rows[0].text

    def test_simple(self) -> None:
        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        replay_ids = [
            uuid.uuid4().hex,
            uuid.uuid4().hex,
            uuid.uuid4().hex,
        ]
        for i, replay_id in enumerate(replay_ids):
            self.store_replays(
                [
                    mock_replay(
                        seq1_timestamp - timedelta(seconds=i * 10),
                        self.project.id,
                        replay_id,
                        segment_id=0,
                        urls=[
                            "http://localhost/",
                            "http://localhost/home/",
                            "http://localhost/profile/",
                        ],
                    ),
                    mock_replay(
                        seq2_timestamp - timedelta(seconds=i * 10),
                        self.project.id,
                        replay_id,
                        segment_id=1,
                    ),
                ]
            )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.assert_replay_table_renders()

            rows = self.browser.elements('[data-test-id="replay-table"] [role="row"]')
            assert len(rows) == 4

            for field in self.header_fields:
                assert field in rows[0].text

            assert replay_ids[0][:8] in rows[1].text
            assert replay_ids[1][:8] in rows[2].text
            assert replay_ids[2][:8] in rows[3].text

    def test_archived(self) -> None:
        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        replay_id = uuid.uuid4().hex
        self.store_replays(
            [
                mock_replay(
                    seq1_timestamp,
                    self.project.id,
                    replay_id,
                ),
                mock_replay(
                    seq2_timestamp,
                    self.project.id,
                    replay_id,
                    is_archived=True,
                ),
            ]
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.assert_replay_table_renders()

            rows = self.browser.elements('[data-test-id="replay-table"] [role="row"]')
            assert len(rows) == 2

            for field in self.header_fields:
                assert field in rows[0].text

            assert replay_id[:8] in rows[1].text
            assert "Deleted Replay" in rows[1].text

    def test_viewed_indicator_has_viewed(self) -> None:
        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        replay_id = uuid.uuid4().hex

        self.store_replays(
            [
                mock_replay(
                    seq1_timestamp,
                    self.project.id,
                    replay_id,
                ),
                mock_replay_viewed(
                    seq2_timestamp.timestamp(),
                    self.project.id,
                    replay_id,
                    self.user.id,
                ),
            ]
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.assert_replay_table_renders()
            rows = self.browser.elements('[data-test-id="replay-table"] [role="row"]')

            for field in self.header_fields:
                assert field in rows[0].text

            assert replay_id[:8] in rows[1].text
            assert not self.browser.element_exists(
                '[data-test-id="replay-table"][role="row"][data-has-viewed="true"]'
            )

    def test_viewed_indicator_not_viewed(self) -> None:
        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        replay_id = uuid.uuid4().hex

        self.store_replays(
            [
                mock_replay(
                    seq1_timestamp,
                    self.project.id,
                    replay_id,
                ),
                mock_replay(
                    seq2_timestamp,
                    self.project.id,
                    replay_id,
                ),
            ]
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.assert_replay_table_renders()
            rows = self.browser.elements('[data-test-id="replay-table"] [role="row"]')

            for field in self.header_fields:
                assert field in rows[0].text

            assert replay_id[:8] in rows[1].text
            assert not self.browser.element_exists(
                '[data-test-id="replay-table"][role="row"][data-has-viewed="false"]'
            )
