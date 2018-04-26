from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
from sentry.models import ProjectOwnership, User, Team
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema


class ProjectOwnershipTestCase(TestCase):
    def test_get_owners_default(self):
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)

    def test_get_owners_basic(self):
        rule_a = Rule(
            Matcher('path', '*.py'), [
                Owner('team', self.team.slug),
            ])

        rule_b = Rule(
            Matcher('path', 'src/*'), [
                Owner('user', self.user.email),
            ])

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([rule_a, rule_b]),
            fallthrough=True,
        )

        # No data matches
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)

        # Match only rule_a
        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'foo.py',
                    }]
                }
            }
        ) == ([Actor(self.team.id, Team)], [rule_a])

        # Match only rule_b
        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'src/thing.txt',
                    }]
                }
            }
        ) == ([Actor(self.user.id, User)], [rule_b])

        # Matches both rule_a and rule_b
        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'src/foo.py',
                    }]
                }
            }
        ) == ([Actor(self.user.id, User), Actor(self.team.id, Team)], [rule_a, rule_b])

        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }
            }
        ) == (ProjectOwnership.Everyone, None)

        # When fallthrough = False, we don't implicitly assign to Everyone
        ProjectOwnership.objects.filter(
            project_id=self.project.id,
        ).update(fallthrough=False)

        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }
            }
        ) == ([], None)
