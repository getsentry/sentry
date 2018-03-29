from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
from sentry.models.projectownership import build_event_rules, build_user_id_to_event_map, resolve_user_actors_map, resolve_team_actors_map, teams_to_user_ids
from sentry.models import OrganizationMember, OrganizationMemberTeam, ProjectOwnership, User, Team
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema

import six


def sort_actors(actors_rules):
    return sorted([actor_rule for actor_rule in actors_rules[0]],
                  key=lambda a: (a.id, a.type))


def assert_event_actors_equal(event_actors1, event_actors2):
    assert len(event_actors1) == len(event_actors2)
    for event, actors_rules in six.iteritems(event_actors1):
        actors1 = sort_actors(actors_rules)
        actors2 = sort_actors(event_actors2[event])
        assert len(actors1) == len(actors2)
        for actor1, actor2 in zip(actors1, actors2):
            assert actor1.id == actor2.id and actor1.type == actor2.type


def make_event_data(filename, url='http://example.com'):
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


class ProjectOwnershipTestCase(TestCase):
    def test_get_owners_default(self):
        assert ProjectOwnership.get_actors(self.project.id, {}) == ProjectOwnership.Everyone

    def test_get_owners_basic(self):
        matcher = Matcher('path', '*.py')

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                Rule(matcher, [
                    Owner('user', self.user.email),
                    Owner('team', self.team.slug),
                ]),
            ]),
            fallthrough=True,
        )

        # No data matches
        assert ProjectOwnership.get_actors(self.project.id, {}) == ProjectOwnership.Everyone

        event = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'foo.py',
                    }]
                }
            }
        )
        assert_event_actors_equal(ProjectOwnership.get_actors(
            self.project.id,
            [event],
        ), {event: (set([Actor(self.user.id, User), Actor(self.team.id, Team)]), matcher)})

        assert ProjectOwnership.get_actors(
            self.project.id,
            [self.create_event(
                group=self.group,
                message=self.group.message,
                project=self.project,
                datetime=self.group.last_seen,
                data={'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }}
            )]

        ) == ProjectOwnership.Everyone

        # When fallthrough = False, we don't implicitly assign to Everyone
        ProjectOwnership.objects.filter(
            project_id=self.project.id,
        ).update(fallthrough=False)

        assert ProjectOwnership.get_actors(
            self.project.id,
            [self.create_event(
                group=self.group,
                message=self.group.message,
                project=self.project,
                datetime=self.group.last_seen,
                data={
                    'sentry.interfaces.Stacktrace': {
                        'frames': [{
                            'filename': 'xxxx',
                        }]
                    }
                })]
        ) == {}


class ProjectOwnershipGetActorsTestCase(TestCase):
    def setUp(self):
        from sentry.ownership.grammar import Rule
        self.user = self.create_user(email='foo@example.com', is_active=True)
        self.user2 = self.create_user(email='baz@example.com', is_active=True)

        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)

        self.project = self.create_project(name='Test', teams=[self.team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user=self.user,
                organization=self.organization,
            ),
            team=self.team,
        )
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team])
        self.group = self.create_group(
            project=self.project,
            message='hello  world',
            logger='root',
        )
        self.rule_team = Rule(Matcher('path', '*.py'), [Owner('team', self.team.slug)])
        self.rule_user = Rule(Matcher('path', '*.jx'), [Owner('user', self.user2.email)])
        self.rule_users = Rule(Matcher('path', '*.cbl'), [
            Owner('user', self.user.email),
            Owner('user', self.user2.email),
        ])
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                self.rule_team,
                self.rule_user,
                self.rule_users,
            ]),
            fallthrough=True,
        )

    def test_get_all_actors(self):
        event1 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=make_event_data('foo.py')
        )
        event2 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=make_event_data('foo.jx')
        )
        event3 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=make_event_data('foo.cbl')
        )
        event4 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=make_event_data('foo.cpp')
        )
        event5 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=make_event_data('http://example.com')
        )
        events = [event1, event2, event3, event4, event5]

        event_actors = {
            event1: (set([Actor(self.team.id, Team)]), self.rule_team.matcher),
            event2: (set([Actor(self.user2.id, User)]), self.rule_user.matcher),
            event3: (set([Actor(self.user.id, User), Actor(self.user2.id, User)]), self.rule_users.matcher),
        }

        assert_event_actors_equal(event_actors,
                                  ProjectOwnership.get_actors(self.project, events))

    def assert_actor_dicts_equal(self, actor_events, expected):
        assert len(actor_events) == len(expected)
        for actor, expected_actor in zip(self.sort_by_id(six.iterkeys(
                actor_events)), self.sort_by_id(six.iterkeys(expected))):
            assert actor.id == expected_actor.id
            assert actor.type == expected_actor.type
            assert self.sort_by_id(
                actor_events[actor]) == self.sort_by_id(
                expected[expected_actor])

    def sort_by_id(self, items):
        return sorted(items, key=lambda x: x.id)

    def test_resolve_user_actors_map(self):
        user1 = self.create_user()
        self.create_member(user=user1, organization=self.organization, teams=[self.team])
        user1_events = [self.create_event(), self.create_event(), self.create_event()]
        user_events = [self.create_event(), user1_events[0]]
        user2_events = [self.create_event()]
        user_owners = {
            Owner('user', user1.email): user1_events,
            Owner('user', self.user.email): user_events,
            Owner('user', self.user2.email): user2_events,
        }
        actor_events = resolve_user_actors_map(user_owners, self.project.id)

        expected = {
            Actor(user1.id, User): user1_events,
            Actor(self.user.id, User): user_events,
            Actor(self.user2.id, User): user2_events
        }
        self.assert_actor_dicts_equal(actor_events, expected)

    def test_resolve_team_actors_map(self):
        team1 = self.create_team()
        team2 = self.create_team()

        project = self.create_project(name='New Test', teams=[team1, team2])

        team1_events = [self.create_event(), self.create_event(), self.create_event()]
        team2_events = [self.create_event(), team1_events[2]]
        team_owners = {
            Owner('team', team1.slug): team1_events,
            Owner('team', team2.slug): team2_events,
        }

        actor_events = resolve_team_actors_map(team_owners, project.id)

        expected = {
            Actor(team1.id, Team): team1_events,
            Actor(team2.id, Team): team2_events
        }
        self.assert_actor_dicts_equal(actor_events, expected)

    def test_teams_to_user_ids(self):
        team1 = self.create_team()
        team2 = self.create_team()

        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()
        user4 = self.create_user()
        user5 = self.create_user()
        user6 = self.create_user()

        self.create_member(user=user1, organization=self.organization, teams=[team1])
        self.create_member(user=user2, organization=self.organization, teams=[team1])
        self.create_member(user=user3, organization=self.organization, teams=[team1])
        self.create_member(user=user4, organization=self.organization, teams=[team1, team2])
        self.create_member(user=user5, organization=self.organization, teams=[team2, self.team])
        self.create_member(user=user6, organization=self.organization, teams=[team2])

        team1_actor = Actor(team1.id, Team)
        team2_actor = Actor(team2.id, Team)
        resolved_teams = teams_to_user_ids([team1_actor, team2_actor])

        assert sorted(resolved_teams[team1_actor]) == [user1.id, user2.id, user3.id, user4.id]
        assert sorted(resolved_teams[team2_actor]) == [user4.id, user5.id, user6.id]


class BuildEventRulesTestCase(TestCase):
    def setUp(self):
        self.team1 = self.create_team()
        self.team2 = self.create_team()
        self.team3 = self.create_team()
        self.project = self.create_project(teams=[self.team1, self.team2, self.team3])

        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.user3 = self.create_user()
        self.user4 = self.create_user()
        self.user5 = self.create_user()
        self.user6 = self.create_user()
        self.user7 = self.create_user()
        self.user8 = self.create_user()

        self.create_member(user=self.user1, organization=self.organization, teams=[self.team1])
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team1])
        self.create_member(user=self.user3, organization=self.organization, teams=[self.team1])
        self.create_member(
            user=self.user4,
            organization=self.organization,
            teams=[
                self.team1,
                self.team2])
        self.create_member(
            user=self.user5,
            organization=self.organization,
            teams=[
                self.team2,
                self.create_team()])
        self.create_member(user=self.user6, organization=self.organization, teams=[self.team2])
        self.create_member(user=self.user7, organization=self.organization, teams=[self.team3])
        self.create_member(user=self.user8, organization=self.organization, teams=[self.team3])

        self.matcher1 = Matcher('path', '*.py')
        self.matcher2 = Matcher('url', '*.co')
        self.matcher3 = Matcher('path', '*.cbl')
        self.matcher4 = Matcher('path', '*.cpp')

        self.rule1 = Rule(self.matcher1, [
            Owner('user', self.user1.email),
            Owner('team', self.team1.slug),
        ])
        self.rule2 = Rule(self.matcher2, [
            Owner('user', self.user1.email),
            Owner('team', self.team2.slug),
        ])
        self.rule3 = Rule(self.matcher3, [
            Owner('user', self.user6.email),
            Owner('user', self.user4.email),
            Owner('user', self.user3.email),
            Owner('user', self.user1.email),
        ])
        self.rule4 = Rule(self.matcher3, [
            Owner('team', self.team1.slug),
            Owner('team', self.team2.slug),
        ])
        self.rule5 = Rule(self.matcher4, [
            Owner('user', self.user7.email),
        ])
        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                self.rule1,
                self.rule2,
                self.rule3,
                self.rule4,
            ]),
            fallthrough=True,
        )

    def test_no_match(self):
        event = self.create_event(data=make_event_data('hello.world', 'world.org'))
        event_rules = build_event_rules(self.ownership, [event])
        assert event_rules[event] == []

    def test_no_schema(self):
        ownership = ProjectOwnership.objects.create(
            project_id=self.create_project(),
            schema=None,
            fallthrough=True,
        )
        event = self.create_event(data=make_event_data('hello.world', 'world.org'))

        event_rules = build_event_rules(ownership, [event])
        assert event_rules == ProjectOwnership.Everyone

    def test_simple(self):
        events = [
            self.create_event(data=make_event_data('hello.world')),
            self.create_event(data=make_event_data('hello.py')),
            self.create_event(data=make_event_data('hello.cbl')),
            self.create_event(data=make_event_data('hello.world', 'hello.co')),
            self.create_event(data=make_event_data('hello.py', 'hello.co')),
            self.create_event(data=make_event_data('hello.cpp')),
        ]
        expected = [[], [
            self.rule1], [
            self.rule3, self.rule4], [
            self.rule2], [
                self.rule1, self.rule2], [
                    self.rule5]]
        event_rules = build_event_rules(self.ownership, events)
        for event, rules in zip(events, expected):
            assert event_rules[event] == rules

    def test_build_user_id_to_event_map(self):
        event1 = self.create_event(data=make_event_data('hello.world'))
        event2 = self.create_event(data=make_event_data('hello.py'))
        event3 = self.create_event(data=make_event_data('hello.cbl'))
        event4 = self.create_event(data=make_event_data('hello.world', 'hello.co'))
        event5 = self.create_event(data=make_event_data('hello.py', 'hello.co'))
        event6 = self.create_event(data=make_event_data('hello.cpp'))
        event_rules = {
            event1: [],
            event2: [self.rule1],
            event3: [self.rule3, self.rule4],
            event4: [self.rule2],
            event5: [self.rule1, self.rule2],
            event6: [self.rule5]
        }
        user_id_to_events = build_user_id_to_event_map(event_rules, self.project.id)

        assert user_id_to_events[self.user1.id] == set([event2, event3, event4, event5])
        assert user_id_to_events[self.user2.id] == set([event3, event2, event5])
        assert user_id_to_events[self.user3.id] == set([event2, event3, event5])
        assert user_id_to_events[self.user4.id] == set([event2, event3, event4, event5])
        assert user_id_to_events[self.user5.id] == set([event3, event4, event5])
        assert user_id_to_events[self.user6.id] == set([event3, event4, event5])
        assert user_id_to_events[self.user7.id] == set([event6])
        assert self.user8.id not in user_id_to_events
