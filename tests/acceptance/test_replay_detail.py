from datetime import datetime, timedelta
from uuid import uuid4

from sentry.replays.testutils import (
    mock_replay,
    mock_rrweb_div_helloworld,
    mock_segment_console,
    mock_segment_fullsnapshot,
    mock_segment_init,
)
from sentry.testutils import ReplaysAcceptanceTestCase

FEATURE_NAME = ["organizations:session-replay", "organizations:session-replay-ui"]


class ReplayDetailTest(ReplaysAcceptanceTestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band 1")
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name="Bengal",
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        replay_id = uuid4().hex
        seq1_timestamp = datetime.now() - timedelta(seconds=52)
        seq2_timestamp = datetime.now() - timedelta(seconds=35)
        self.store_replays(
            [
                mock_replay(seq1_timestamp, self.project.id, replay_id, segment_id=0),
                mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1),
            ]
        )
        segments = [
            mock_segment_init(seq2_timestamp),
            mock_segment_fullsnapshot(seq2_timestamp, [mock_rrweb_div_helloworld()]),
            mock_segment_console(seq2_timestamp),
        ]
        for (segment_id, segment) in enumerate(segments):
            self.store_replay_segments(replay_id, self.project.id, segment_id, segment)

        self.login_as(self.user)

        slug = f"{self.project.slug}:{replay_id}"
        self.path = f"/organizations/{self.org.slug}/replays/{slug}/"

    def test_no_feature(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("replay detail no feature")

    def test_not_found(self):
        with self.feature(FEATURE_NAME):
            slug = f"{self.project.slug}:abcdef"
            self.path = f"/organizations/{self.org.slug}/replays/{slug}/"

            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.snapshot("replay detail no feature")

    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.snapshot("replay detail")
