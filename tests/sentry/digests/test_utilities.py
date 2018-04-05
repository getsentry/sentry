from __future__ import absolute_import

from sentry.api.fields.actor import Actor
from sentry.digests.notifications import build_digest, event_to_record
from sentry.digests.utilities import (
    # get_personalized_digests,
    get_events_from_digest,
    # build_custom_digest,
    build_events_by_actor,
    convert_actors_to_user_set,
    team_to_user_ids,
)
from sentry.models import ProjectOwnership, Team, User
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema
from sentry.testutils import TestCase


class UtilitiesTestCase(TestCase):
    def create_event_data(self, filename, url='http://example.com'):
        data = {
            'tags': [('level', 'error')],
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': filename,
                    },
                ],
            },
            'sentry.interfaces.Http': {
                'url': url
            },
        }
        return data

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

    def test_convert_actors_to_user_set(self):
        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()
        user4 = self.create_user()

        team1 = self.create_team()
        team2 = self.create_team()

        self.create_member(user=user1, organization=self.organization, teams=[team1])
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_member(user=user3, organization=self.organization, teams=[team1, team2])
        self.create_member(user=user4, organization=self.organization, teams=[])

        team1_events = set([
            self.create_event(),
            self.create_event(),
            self.create_event(),
            self.create_event(),
        ])
        team2_events = set([
            self.create_event(),
            self.create_event(),
            self.create_event(),
            self.create_event(),
        ])
        user4_events = set([self.create_event(), self.create_event()])
        events_by_actor = {
            Actor(team1.id, Team): team1_events,
            Actor(team2.id, Team): team2_events,
            Actor(user1.id, User): team1_events.union(team2_events),
            Actor(user4.id, User): user4_events,
        }
        user_by_events = {
            user1.id: team1_events,
            user2.id: team2_events,
            user3.id: team1_events.union(team2_events),
            user4.id: user4_events,
        }
        assert convert_actors_to_user_set(events_by_actor) == user_by_events

    def test_build_events_by_actor(self):
        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()
        user4 = self.create_user()

        team1 = self.create_team()
        team2 = self.create_team()
        team3 = self.create_team()

        self.project = self.create_project(teams=[team1, team2, team3])

        self.create_member(user=user1, organization=self.organization, teams=[team1])
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_member(user=user3, organization=self.organization, teams=[team1, team2])
        self.create_member(user=user4, organization=self.organization, teams=[team3])

        team1_events = set([
            self.create_event(data=self.create_event_data('hello.py')),
            self.create_event(data=self.create_event_data('goodbye.py')),
            self.create_event(data=self.create_event_data('hola.py')),
            self.create_event(data=self.create_event_data('adios.py')),
        ])
        team2_events = set([
            self.create_event(data=self.create_event_data('old.cbl')),
            self.create_event(data=self.create_event_data('retro.cbl')),
            self.create_event(data=self.create_event_data('cool.cbl')),
            self.create_event(data=self.create_event_data('gem.cbl')),
        ])
        user4_events = set([
            self.create_event(data=self.create_event_data('foo.bar', 'helloworld.org')),
            self.create_event(data=self.create_event_data('bar.foo', 'helloworld.org')),
        ])

        team1_matcher = Matcher('path', '*.py')
        team2_matcher = Matcher('path', '*.cbl')
        user4_matcher = Matcher('url', '*.org')

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                Rule(team1_matcher, [
                    Owner('team', team1.slug),
                    Owner('user', user3.email),
                ]),
                Rule(team2_matcher, [
                    Owner('team', team2.slug),
                ]),
                Rule(user4_matcher, [
                    Owner('user', user4.email),
                ]),
            ]),
            fallthrough=True,
        )
        events = team1_events.union(team2_events.union(user4_events))

        events_by_actor = {
            Actor(team1.id, Team): team1_events,
            Actor(team2.id, Team): team2_events,
            Actor(user3.id, User): team1_events,
            Actor(user4.id, User): user4_events,
        }
        assert build_events_by_actor(self.project.id, events) == events_by_actor
