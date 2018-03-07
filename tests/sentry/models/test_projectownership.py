from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
from sentry.models import ProjectOwnership, User, Team
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema


class ProjectOwnershipTestCase(TestCase):
    def test_get_owners_default(self):
        assert ProjectOwnership.get_owners(self.project.id, {}) == ProjectOwnership.Everyone

    def test_get_owners_basic(self):
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                Rule(Matcher('path', '*.py'), [
                    Owner('user', self.user.email),
                    Owner('team', self.team.slug),
                ]),
            ]),
            fallthrough=True,
        )

        # No data matches
        assert ProjectOwnership.get_owners(self.project.id, {}) == ProjectOwnership.Everyone

        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'foo.py',
                    }]
                }
            }
        ) == [Actor(self.user.id, User), Actor(self.team.id, Team)]

        assert ProjectOwnership.get_owners(
            self.project.id, {
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'filename': 'xxxx',
                    }]
                }
            }
        ) == ProjectOwnership.Everyone

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
        ) == []
