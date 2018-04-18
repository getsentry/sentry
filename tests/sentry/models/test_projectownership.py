from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
from sentry.models import ProjectOwnership, User, Team
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema


class ProjectOwnershipTestCase(TestCase):
    def test_get_actors_default(self):
        assert ProjectOwnership.get_actors(self.project.id, {}) == (ProjectOwnership.Everyone, None)

    def test_get_actors_basic(self):
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
        assert ProjectOwnership.get_actors(self.project.id, {}) == (ProjectOwnership.Everyone, None)

        event = self.create_event(
            group=self.create_group(project=self.project),
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'foo.py',
                    }]
                }
            })
        assert ProjectOwnership.get_actors(
            self.project.id, [event]
        )[event] == ([Actor(self.user.id, User), Actor(self.team.id, Team)], matcher)

        event = self.create_event(
            group=self.create_group(project=self.project),
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }
            })
        assert ProjectOwnership.get_actors(
            self.project.id, [event]
        ) == (ProjectOwnership.Everyone, None)

        # When fallthrough = False, we don't implicitly assign to Everyone
        ProjectOwnership.objects.filter(
            project_id=self.project.id,
        ).update(fallthrough=False)

        event = self.create_event(
            group=self.create_group(project=self.project),
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }
            })
        assert ProjectOwnership.get_actors(
            self.project.id, [event]
        ) == ([], None)
