from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.fields.actor import Actor
from sentry.models import ProjectOwnership, User, Team
from sentry.models.projectownership import resolve_actors
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema
from sentry.utils.cache import cache


class ProjectOwnershipTestCase(TestCase):
    def tearDown(self):
        cache.delete(ProjectOwnership.get_cache_key(self.project.id))

        super(ProjectOwnershipTestCase, self).tearDown()

    def assert_ownership_equals(self, o1, o2):
        assert sorted(o1[0]) == sorted(o2[0]) and sorted(o1[1]) == sorted(o2[1])

    def test_get_owners_default(self):
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)

    def test_get_owners_no_record(self):
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)

    def test_get_owners_basic(self):
        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule_a, rule_b]), fallthrough=True
        )

        # No data matches
        assert ProjectOwnership.get_owners(self.project.id, {}) == (ProjectOwnership.Everyone, None)

        # Match only rule_a
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "foo.py"}]}}
            ),
            ([Actor(self.team.id, Team)], [rule_a]),
        )

        # Match only rule_b
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/thing.txt"}]}}
            ),
            ([Actor(self.user.id, User)], [rule_b]),
        )

        # Matches both rule_a and rule_b
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/foo.py"}]}}
            ),
            ([Actor(self.team.id, Team), Actor(self.user.id, User)], [rule_a, rule_b]),
        )

        assert ProjectOwnership.get_owners(
            self.project.id, {"stacktrace": {"frames": [{"filename": "xxxx"}]}}
        ) == (ProjectOwnership.Everyone, None)

        # When fallthrough = False, we don't implicitly assign to Everyone
        owner = ProjectOwnership.objects.get(project_id=self.project.id)
        owner.fallthrough = False
        owner.save()

        assert ProjectOwnership.get_owners(
            self.project.id, {"stacktrace": {"frames": [{"filename": "xxxx"}]}}
        ) == ([], None)

        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/foo.py"}]}}
            ),
            ([Actor(self.team.id, Team), Actor(self.user.id, User)], [rule_a, rule_b]),
        )


class ResolveActorsTestCase(TestCase):
    def test_no_actors(self):
        assert resolve_actors([], self.project.id) == {}

    def test_basic(self):
        owners = [Owner("user", self.user.email), Owner("team", self.team.slug)]
        assert resolve_actors(owners, self.project.id) == {
            owners[0]: Actor(self.user.id, User),
            owners[1]: Actor(self.team.id, Team),
        }

    def test_teams(self):
        # Normal team
        owner1 = Owner("team", self.team.slug)
        actor1 = Actor(self.team.id, Team)

        # Team that doesn't exist
        owner2 = Owner("team", "nope")
        actor2 = None

        # A team that's not ours
        otherteam = Team.objects.exclude(projectteam__project_id=self.project.id)[0]
        owner3 = Owner("team", otherteam.slug)
        actor3 = None

        assert resolve_actors([owner1, owner2, owner3], self.project.id) == {
            owner1: actor1,
            owner2: actor2,
            owner3: actor3,
        }

    def test_users(self):
        # Normal user
        owner1 = Owner("user", self.user.email)
        actor1 = Actor(self.user.id, User)

        # An extra secondary email
        email1 = self.create_useremail(self.user, None, is_verified=True).email
        owner2 = Owner("user", email1)
        actor2 = actor1  # They map to the same user since it's just a secondary email

        # Another secondary email, that isn't verified
        email2 = self.create_useremail(self.user, None, is_verified=False).email
        owner3 = Owner("user", email2)
        # Intentionally allow unverified emails
        # actor3 = None
        actor3 = actor1

        # An entirely unknown user
        owner4 = Owner("user", "nope")
        actor4 = None

        # A user that doesn't belong with us
        otheruser = self.create_user()
        owner5 = Owner("user", otheruser.email)
        actor5 = None

        # Case-insensitive for user
        owner6 = Owner("user", self.user.email.upper())
        actor6 = actor1

        assert resolve_actors(
            [owner1, owner2, owner3, owner4, owner5, owner6], self.project.id
        ) == {
            owner1: actor1,
            owner2: actor2,
            owner3: actor3,
            owner4: actor4,
            owner5: actor5,
            owner6: actor6,
        }
