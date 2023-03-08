from datetime import datetime, timedelta
from uuid import uuid4

from sentry.models import Project
from sentry.replays.testutils import mock_replay
from sentry.testutils import ReplaysAcceptanceTestCase

FEATURE_NAME = ["organizations:session-replay"]


class ReplayListTest(ReplaysAcceptanceTestCase):
    def setUp(self):
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

        seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
        seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
        for replay_id in [uuid4().hex, uuid4().hex, uuid4().hex]:
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

        self.login_as(self.user)

        self.path = f"/organizations/{self.org.slug}/replays/"

    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.snapshot("replay list")
