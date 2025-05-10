from unittest.mock import patch

from sentry.issues.ownership.grammar import Matcher, Owner, Rule, dump_schema, resolve_actors
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType, OwnerRuleType
from sentry.models.projectownership import ProjectOwnership
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.types.actor import Actor, ActorType
from sentry.users.models.user_avatar import UserAvatar
from sentry.users.services.user.service import user_service

pytestmark = requires_snuba


def actor_key(actor):
    return actor.id


class ProjectOwnershipTestCase(TestCase):
    def setUp(self):
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.user2 = self.create_user("bar@localhost", username="bar")
        self.organization.member_set.create(user_id=self.user2.id)
        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )
        self.team2 = self.create_team(
            organization=self.organization, slug="dolphin-team", members=[self.user]
        )
        self.team3 = self.create_team(
            organization=self.organization, slug="barracuda-team", members=[self.user2]
        )
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team, self.team2]
        )

    def python_event_data(self):
        return {
            "message": "Kaboom!",
            "platform": "python",
            "timestamp": before_now(seconds=10).isoformat(),
            "stacktrace": {
                "frames": [
                    {
                        "function": "handle_set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/api/foo.py",
                        "module": "sentry.api",
                        "in_app": True,
                        "lineno": 30,
                        "filename": "sentry/api/foo.py",
                    },
                    {
                        "function": "set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                        "module": "sentry.models.release",
                        "in_app": True,
                        "lineno": 39,
                        "filename": "sentry/models/release.py",
                    },
                ]
            },
            "tags": {"sentry:release": self.release.version},
        }

    def assert_ownership_equals(self, o1, o2):
        # Ensure actors match
        assert sorted(o1[0], key=actor_key) == sorted(o2[0], key=actor_key)
        # Ensure rules match
        assert sorted(o1[1]) == sorted(o2[1])

    def test_get_owners_default(self):
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        assert ProjectOwnership.get_owners(self.project.id, {}) == ([], None)

    def test_get_owners_no_record(self):
        assert ProjectOwnership.get_owners(self.project.id, {}) == ([], None)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        assert ProjectOwnership.get_owners(self.project.id, {}) == ([], None)

    def test_get_owners_basic(self):
        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule_a, rule_b]), fallthrough=True
        )

        # No data matches
        assert ProjectOwnership.get_owners(self.project.id, {}) == ([], None)

        # Match only rule_a
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "foo.py"}]}}
            ),
            ([Actor(id=self.team.id, actor_type=ActorType.TEAM)], [rule_a]),
        )

        # Match only rule_b
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/thing.txt"}]}}
            ),
            ([Actor(id=self.user.id, actor_type=ActorType.USER)], [rule_b]),
        )

        # Matches both rule_a and rule_b
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/foo.py"}]}}
            ),
            (
                [
                    Actor(id=self.team.id, actor_type=ActorType.TEAM),
                    Actor(id=self.user.id, actor_type=ActorType.USER),
                ],
                [rule_a, rule_b],
            ),
        )

        # We should be ignoring the fallthrough flag
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
            (
                [
                    Actor(id=self.team.id, actor_type=ActorType.TEAM),
                    Actor(id=self.user.id, actor_type=ActorType.USER),
                ],
                [rule_a, rule_b],
            ),
        )

    def test_get_owners_when_codeowners_exists_and_no_issueowners(self):
        # This case will never exist bc we create a ProjectOwnership record if none exists when creating a ProjectCodeOwner record.
        # We have this testcase for potential corrupt data.
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_a = Rule(Matcher("path", "*.js"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project,
            self.code_mapping,
            raw="*.js @tiger-team",
            schema=dump_schema([rule_a]),
        )
        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project.id, {"stacktrace": {"frames": [{"filename": "src/foo.js"}]}}
            ),
            (
                [Actor(id=self.team.id, actor_type=ActorType.TEAM)],
                [rule_a],
            ),
        )

    def test_get_owners_when_codeowners_and_issueowners_exists(self):
        self.code_mapping = self.create_code_mapping(project=self.project2)

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])
        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team2.slug)])

        ProjectOwnership.objects.create(
            project_id=self.project2.id, schema=dump_schema([rule_a, rule_b]), fallthrough=True
        )

        self.create_codeowners(
            self.project2, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.assert_ownership_equals(
            ProjectOwnership.get_owners(
                self.project2.id, {"stacktrace": {"frames": [{"filename": "api/foo.py"}]}}
            ),
            (
                [
                    Actor(id=self.team.id, actor_type=ActorType.TEAM),
                    Actor(id=self.team2.id, actor_type=ActorType.TEAM),
                ],
                [rule_a, rule_c],
            ),
        )

    def test_get_issue_owners_no_codeowners_or_issueowners(self):
        assert ProjectOwnership.get_issue_owners(self.project.id, {}) == []

    def test_get_issue_owners_only_issueowners_exists(self):
        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([rule_a, rule_b]),
        )

        # No data matches
        assert ProjectOwnership.get_issue_owners(self.project.id, {}) == []

        # Match on stacktrace
        assert ProjectOwnership.get_issue_owners(
            self.project.id,
            {"stacktrace": {"frames": [{"filename": "foo.py"}]}},
        ) == [(rule_a, [self.team], OwnerRuleType.OWNERSHIP_RULE.value)]

    def test_get_issue_owners_where_owner_is_not_in_project(self):
        self.project_2 = self.create_project(organization=self.organization, teams=[self.team3])

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user2.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([rule_a, rule_b]),
        )

        # Match on stacktrace but owner is not in the Project
        assert (
            ProjectOwnership.get_issue_owners(
                self.project.id,
                {"stacktrace": {"frames": [{"filename": "src/foo.js"}]}},
            )
            == []
        )

    def test_get_issue_owners_only_codeowners_exists_with_default_assignment_settings(self):
        # This case will never exist bc we create a ProjectOwnership record if none exists when creating a ProjectCodeOwner record.
        # We have this testcase for potential corrupt data.
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_a = Rule(Matcher("path", "*.js"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project,
            self.code_mapping,
            raw="*.js @tiger-team",
            schema=dump_schema([rule_a]),
        )
        # No data matches
        assert ProjectOwnership.get_issue_owners(self.project.id, {}) == []

        # Match on stacktrace
        assert ProjectOwnership.get_issue_owners(
            self.project.id, {"stacktrace": {"frames": [{"filename": "foo.js"}]}}
        ) == [(rule_a, [self.team], OwnerRuleType.CODEOWNERS.value)]

    def test_get_issue_owners_when_codeowners_and_issueowners_exists(self):
        self.code_mapping = self.create_code_mapping(project=self.project2)

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/foo.py"), [Owner("user", self.user.email)])
        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team2.slug)])

        ProjectOwnership.objects.create(
            project_id=self.project2.id,
            schema=dump_schema([rule_a, rule_b]),
            fallthrough=True,
        )

        self.create_codeowners(
            self.project2, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        assert ProjectOwnership.get_issue_owners(
            self.project2.id, {"stacktrace": {"frames": [{"filename": "api/foo.py"}]}}
        ) == [
            (rule_a, [self.team], OwnerRuleType.OWNERSHIP_RULE.value),
            (rule_c, [self.team2], OwnerRuleType.CODEOWNERS.value),
        ]

        # more than 2 matches
        assert ProjectOwnership.get_issue_owners(
            self.project2.id, {"stacktrace": {"frames": [{"filename": "src/foo.py"}]}}
        ) == [
            (rule_b, [self.rpc_user], OwnerRuleType.OWNERSHIP_RULE.value),
            (rule_a, [self.team], OwnerRuleType.OWNERSHIP_RULE.value),
        ]

    def test_handle_auto_assignment_when_only_codeowners_exists(self):
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(rule_c)},
        )

        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

    def test_handle_auto_assignment_when_only_suspect_commit_exists_multiple_emails(self):
        """Test that if a user has 2 verified email addresses, the non-primary one is the commit author, and the project
        is using the suspect committer auto assignment we correctly assign the issue to the user.
        """
        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project2.id,
            fallthrough=False,
            auto_assignment=True,
            suspect_committer_auto_assignment=True,
        )
        self.repo = Repository.objects.create(
            organization_id=self.project2.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.second_email = self.create_useremail(
            user=self.user2, email="hb@mysecondemail.com", is_verified=True
        )
        self.commit_author = self.create_commit_author(
            project=self.project2, user=self.user2, email=self.second_email.email
        )
        self.commit = self.create_commit(
            project=self.project2,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project2.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user2.id,
            team_id=None,
            project=self.project2,
            organization=self.project2.organization,
            context={"commitId": self.commit.id},
        )

        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.user_id == self.user2.id

    def test_handle_skip_auto_assignment(self):
        """Test that if an issue has already been manually assigned, we skip overriding the assignment
        on a future event with auto-assignment.
        """
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(rule_c)},
        )

        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

        # manually assign the issue to someone else
        assert self.event.group is not None
        GroupAssignee.objects.assign(self.event.group, self.user)

        # ensure the issue was not reassigned
        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.user_id == self.user.id

    @patch("sentry.models.GroupAssignee.objects.assign")
    def test_handle_skip_auto_assignment_same_assignee(self, mock_assign):
        """Test that if an issue has already been assigned, we skip the assignment
        on a future event with auto-assignment if the assignee won't change.
        """
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(rule_c)},
        )
        GroupAssignee.objects.create(group=self.event.group, project=self.project, team=self.team)

        # ensure we skip calling assign
        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        mock_assign.assert_not_called()

    def test_handle_auto_assignment_when_codeowners_and_issueowners_exists(self):
        self.code_mapping = self.create_code_mapping(project=self.project2)

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])
        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team2.slug)])

        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project2.id,
            schema=dump_schema([rule_a, rule_b]),
            fallthrough=True,
            auto_assignment=False,
            suspect_committer_auto_assignment=False,
        )

        self.create_codeowners(
            self.project2, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project2.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project2,
            organization=self.project2.organization,
            context={"rule": str(rule_a)},
        )

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team2.id,
            project=self.project2,
            organization=self.project2.organization,
            context={"rule": str(rule_c)},
        )

        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 0

        # Turn on auto assignment
        self.ownership.auto_assignment = True
        self.ownership.suspect_committer_auto_assignment = True
        self.ownership.save()
        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

    def test_no_group_owner(self):
        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project2.id,
        )

        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 0

    def test_handle_auto_assignment_when_suspect_committer_and_codeowners_and_issueowners_exists(
        self,
    ):
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project2,
        )
        self.commit_author = self.create_commit_author(project=self.project2, user=self.user2)
        self.commit = self.create_commit(
            project=self.project2,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        rule_b = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])
        rule_c = Rule(Matcher("path", "*.py"), [Owner("team", self.team3.slug)])

        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project2.id,
            schema=dump_schema([rule_a, rule_b]),
            fallthrough=True,
            auto_assignment=False,
            suspect_committer_auto_assignment=False,
        )

        self.create_codeowners(
            self.project2, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_c])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project2.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            project=self.project2,
            user_id=self.user2.id,
            team_id=None,
            organization=self.project2.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project2,
            organization=self.project2.organization,
            context={"rule": str(rule_a)},
        )

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team3.id,
            project=self.project2,
            organization=self.project.organization,
            context={"rule": str(rule_c)},
        )

        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 0

        # Turn on auto assignment
        self.ownership.auto_assignment = True
        self.ownership.suspect_committer_auto_assignment = True
        self.ownership.save()
        ProjectOwnership.handle_auto_assignment(self.project2.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.user_id == self.user2.id

    def test_abs_path_when_filename_present(self):
        frame = {
            "filename": "computer.cpp",
            "abs_path": "C:\\My\\Path\\computer.cpp",
        }
        rule = Rule(Matcher("path", "*My\\Path*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule]), fallthrough=True
        )
        assert ProjectOwnership.get_owners(
            self.project.id, {"stacktrace": {"frames": [frame]}}
        ) == ([Actor(id=self.team.id, actor_type=ActorType.TEAM)], [rule])

    def test_saves_without_either_auto_assignment_option(self):
        self.group = self.create_group(project=self.project)
        # Turn off all autoassignment
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            suspect_committer_auto_assignment=False,
            auto_assignment=False,
        )
        assert ProjectOwnership.get_owners(self.project.id, {}) == ([], None)

    def test_force_handle_auto_assignment(self):
        # Run auto-assignment first
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_a])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(rule_a)},
        )

        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

        # Unassign the auto-assigned user
        GroupAssignee.objects.deassign(self.event.group, self.user)
        assert len(GroupAssignee.objects.all()) == 0

        # Manually assign the group to someone else
        GroupAssignee.objects.assign(self.event.group, self.user)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.user_id == self.user.id

        # Run force auto-assignment
        ProjectOwnership.handle_auto_assignment(
            self.project.id,
            group=self.event.group,
            force_autoassign=True,
        )
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

    def test_force_handle_auto_assignment_cache_check(self):
        # Run auto-assignment first
        self.code_mapping = self.create_code_mapping(project=self.project)

        rule_a = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])

        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @tiger-team", schema=dump_schema([rule_a])
        )

        self.event = self.store_event(
            data=self.python_event_data(),
            project_id=self.project.id,
        )
        assert self.event.group is not None

        GroupOwner.objects.create(
            group=self.event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(rule_a)},
        )

        ProjectOwnership.handle_auto_assignment(self.project.id, self.event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=self.event.group)
        assert assignee.team_id == self.team.id

    def test_autoassignment_with_multiple_codeowners(self):
        processing_team = self.create_team(
            organization=self.organization, slug="processing-team", members=[self.user]
        )
        payment_team = self.create_team(
            organization=self.organization, slug="payment-team", members=[self.user2]
        )

        project = self.create_project(
            organization=self.organization, teams=[processing_team, payment_team], slug="rotation"
        )
        data = {
            "stacktrace": {
                "frames": [
                    {"abs_path": "/app/payment_service.rb", "in_app": True},
                    {"abs_path": "/app/processing_unit.rb", "in_app": True},
                    {"abs_path": "/app/processing_unit.rb", "in_app": True},
                ]
            }
        }

        event = self.store_event(
            data=data,
            project_id=project.id,
        )

        rules = [
            Rule(Matcher("codeowners", "*payment*"), [Owner("team", payment_team.slug)]),
            Rule(
                Matcher("codeowners", "/app/processing_unit.rb"),
                [Owner("team", processing_team.slug)],
            ),
        ]

        ProjectOwnership.objects.create(
            project_id=project.id, schema=dump_schema(rules), fallthrough=True
        )

        assert len(ProjectOwnership.get_issue_owners(project.id, data)) == 2

        # Order of group owners should be determined by `get_issue_owners` which has the correct order
        group_owners = [
            GroupOwner(
                group=event.group,
                type=GroupOwnerType.CODEOWNERS.value,
                user_id=None,
                team_id=processing_team.id,
                project=project,
                organization=project.organization,
                context={"rule": str(rules[1])},
            ),
            GroupOwner(
                group=event.group,
                type=GroupOwnerType.CODEOWNERS.value,
                user_id=None,
                team_id=payment_team.id,
                project=project,
                organization=project.organization,
                context={"rule": str(rules[0])},
            ),
        ]

        GroupOwner.objects.bulk_create(group_owners)

        ProjectOwnership.handle_auto_assignment(project.id, event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=event.group)
        assert assignee.team_id == processing_team.id


class ResolveActorsTestCase(TestCase):
    def test_no_actors(self):
        assert resolve_actors([], self.project.id) == {}

    def test_basic(self):
        owners = [Owner("user", self.user.email), Owner("team", self.team.slug)]
        assert resolve_actors(owners, self.project.id) == {
            owners[0]: Actor(id=self.user.id, actor_type=ActorType.USER),
            owners[1]: Actor(id=self.team.id, actor_type=ActorType.TEAM),
        }

    def test_teams(self):
        # Normal team
        owner1 = Owner("team", self.team.slug)
        actor1 = Actor(id=self.team.id, actor_type=ActorType.TEAM)

        # Team that doesn't exist
        owner2 = Owner("team", "nope")
        actor2 = None

        # A team that's not ours
        self.create_project(teams=[self.create_team()])
        otherteam = self.create_team()
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
        actor1 = Actor(id=self.user.id, actor_type=ActorType.USER)

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

    def test_with_user_avatar(self):
        # Check for regressions associated with serializing to RpcUser with a
        # non-null UserAvatar

        user = self.create_user()
        with assume_test_silo_mode_of(UserAvatar):
            UserAvatar.objects.create(user=user)

        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(organization=org, teams=[team])

        owner = Owner("user", user.email)
        resolve_actors([owner], project.id)
