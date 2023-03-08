from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from sentry.replays.testutils import (
    mock_replay,
    mock_rrweb_div_helloworld,
    mock_segment_console,
    mock_segment_fullsnapshot,
    mock_segment_init,
    mock_segment_nagivation,
)
from sentry.testutils import ReplaysAcceptanceTestCase

FEATURE_NAME = ["organizations:session-replay"]


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
            self.browser.snapshot("replay detail not found")

    @pytest.mark.skip(reason="flaky: https://github.com/getsentry/sentry/issues/42263")
    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.snapshot("replay detail")
