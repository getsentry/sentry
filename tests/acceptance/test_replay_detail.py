from datetime import datetime, timedelta

from sentry.replays.testutils import (
    mock_replay,
    mock_rrweb_div_helloworld,
    mock_segment_console,
    mock_segment_fullsnapshot,
    mock_segment_init,
    mock_segment_nagivation,
)
from sentry.testutils.cases import ReplaysAcceptanceTestCase
from sentry.testutils.silo import no_silo_test

FEATURE_NAME = ["organizations:session-replay", "organizations:performance-view"]


@no_silo_test
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

        replay_id = "b58a67446c914f44a4e329763420047b"
        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        self.store_replays(
            [
                mock_replay(
                    seq1_timestamp,
                    self.project.id,
                    replay_id,
                    segment_id=0,
                    urls=[
                        "http://localhost/",
                        "http://localhost/home/",
                        "http://localhost/profile/",
                    ],
                ),
                mock_replay(seq2_timestamp, self.project.id, replay_id, segment_id=1),
            ]
        )
        segments = [
            mock_segment_init(seq2_timestamp),
            mock_segment_fullsnapshot(seq2_timestamp, [mock_rrweb_div_helloworld()]),
            mock_segment_console(seq2_timestamp),
            mock_segment_nagivation(
                seq2_timestamp + timedelta(seconds=1), hrefFrom="/", hrefTo="/home/"
            ),
            mock_segment_nagivation(
                seq2_timestamp + timedelta(seconds=2), hrefFrom="/home/", hrefTo="/profile/"
            ),
        ]
        for (segment_id, segment) in enumerate(segments):
            self.store_replay_segments(replay_id, self.project.id, segment_id, segment)

        self.login_as(self.user)

        slug = f"{self.project.slug}:{replay_id}"
        self.path = f"/organizations/{self.org.slug}/replays/{slug}/"

    def test_not_found(self):
        with self.feature(FEATURE_NAME):
            slug = f"{self.project.slug}:abcdef"
            self.path = f"/organizations/{self.org.slug}/replays/{slug}/"

            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_console_tab(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.click('[data-test-id="replay-details-console-btn"]')
            self.browser.wait_until_test_id("replay-details-console-tab")

    def test_network_tab(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.click('[data-test-id="replay-details-network-btn"]')
            self.browser.wait_until_test_id("replay-details-network-tab")

    def test_memory_tab(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.click('[data-test-id="replay-details-memory-btn"]')
            self.browser.wait_until_test_id("replay-details-memory-tab")

    def test_errors_tab(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.click('[data-test-id="replay-details-errors-btn"]')
            self.browser.wait_until_test_id("replay-details-errors-tab")

    def test_trace_tab(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.click('[data-test-id="replay-details-trace-btn"]')
            self.browser.wait_until_test_id("replay-details-trace-tab")
