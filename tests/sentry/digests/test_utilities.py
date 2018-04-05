from __future__ import absolute_import

from sentry.digests.notifications import build_digest, event_to_record
from sentry.digests.utilities import (
    # get_personalized_digests,
    get_events_from_digest,
    # build_custom_digest,
    # build_events_by_actor,
    # convert_actors_to_user_set,
    team_to_user_ids,
)
from sentry.testutils import TestCase


class UtilitiesTestCase(TestCase):
    def test_get_events_from_digest(self):
        project = self.create_project()
        rule = project.rule_set.all()[0]
        events = [
            self.create_event(group=self.create_group(project=project)),
            self.create_event(group=self.create_group(project=project)),
            self.create_event(group=self.create_group(project=project)),
            self.create_event(group=self.create_group(project=project)),
            self.create_event(group=self.create_group(project=project)),
        ]
        digest = build_digest(
            project,
            (
                event_to_record(events[4], (rule, )),
                event_to_record(events[3], (rule, )),
                event_to_record(events[2], (rule, )),
                event_to_record(events[1], (rule, )),
                event_to_record(events[0], (rule, )),
            ),
        )

        assert get_events_from_digest(digest) == set(events)

    def test_team_to_user_ids(self):
        team1 = self.create_team()
        team2 = self.create_team()
        users = [self.create_user() for i in range(0, 6)]

        self.create_member(user=users[0], organization=self.organization, teams=[team1])
        self.create_member(user=users[1], organization=self.organization, teams=[team1])
        self.create_member(user=users[2], organization=self.organization, teams=[team1])
        self.create_member(user=users[3], organization=self.organization, teams=[team1, team2])
        self.create_member(user=users[4], organization=self.organization, teams=[team2, self.team])
        self.create_member(user=users[5], organization=self.organization, teams=[team2])

        assert sorted(team_to_user_ids(team1.id)) == [
            users[0].id, users[1].id, users[2].id, users[3].id]
        assert sorted(team_to_user_ids(team2.id)) == [users[3].id, users[4].id, users[5].id]
