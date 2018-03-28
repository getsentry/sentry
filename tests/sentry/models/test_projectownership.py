from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
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

    def make_event_data(self, filename, url='http://example.com'):
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

    def test_get_all_actors(self):
        event1 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.py')
        )
        event2 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.jx')
        )
        event3 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.cbl')
        )
        event4 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.cpp')
        )
        event5 = self.create_event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('http://example.com')
        )
        events = [event1, event2, event3, event4, event5]

        event_actors = {
            event1: (set([Actor(self.team.id, Team)]), self.rule_team.matcher),
            event2: (set([Actor(self.user2.id, User)]), self.rule_user.matcher),
            event3: (set([Actor(self.user.id, User), Actor(self.user2.id, User)]), self.rule_users.matcher),
        }

        assert_event_actors_equal(event_actors,
                                  ProjectOwnership.get_actors(self.project, events))
