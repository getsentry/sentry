from typing import Iterable, Mapping, Optional, Sequence, Union

import pytest

from sentry.eventstore.models import Event
from sentry.models import NotificationSetting, Project, ProjectOwnership, Team, User
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.grouprelease import GroupRelease
from sentry.models.repository import Repository
from sentry.notifications.types import (
    ActionTargetType,
    FallthroughChoiceType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils.participants import (
    FALLTHROUGH_NOTIFICATION_LIMIT_EA,
    get_fallthrough_recipients,
    get_owner_reason,
    get_owners,
    get_send_to,
)
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.services.hybrid_cloud.user import RpcUser, user_service
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils.cache import cache
from tests.sentry.mail import make_event_data

STACKTRACE = {
    "frames": [
        {
            "function": "handledError",
            "abs_path": "Application.java",
            "module": "io.sentry.example.Application",
            "in_app": True,
            "lineno": 39,
            "filename": "Application.java",
        },
    ]
}


class GetSendToMemberTest(TestCase):
    def get_send_to_member(
        self, project: Optional[Project] = None, user_id: Optional[int] = None
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            project=project or self.project,
            target_type=ActionTargetType.MEMBER,
            target_identifier=user_id or self.user.id,
        )

    def test_invalid_user(self):
        assert self.get_send_to_member(self.project, 900001) == {}

    def test_send_to_user(self):
        assert self.get_send_to_member() == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)},
        }

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

        assert self.get_send_to_member() == {
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)}
        }

    def test_other_org_user(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        team_3 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2, team_3])

        assert self.get_send_to_member(project_2, user_2.id) == {
            ExternalProviders.EMAIL: {user_service.get_user(user_2.id)},
            ExternalProviders.SLACK: {user_service.get_user(user_2.id)},
        }
        assert self.get_send_to_member(self.project, user_2.id) == {}

    def test_no_project_access(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        user_3 = self.create_user()
        self.create_team(org_2, members=[user_3])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        assert self.get_send_to_member(project_2, user_2.id) == {
            ExternalProviders.EMAIL: {user_service.get_user(user_2.id)},
            ExternalProviders.SLACK: {user_service.get_user(user_2.id)},
        }
        assert self.get_send_to_member(self.project, user_3.id) == {}


@region_silo_test
class GetSendToTeamTest(TestCase):
    def setUp(self):
        super().setUp()
        # disable slack
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            team=self.team,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )

    def get_send_to_team(
        self, project: Optional[Project] = None, team_id: Optional[int] = None
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            project=project or self.project,
            target_type=ActionTargetType.TEAM,
            target_identifier=team_id or self.team.id,
        )

    def test_invalid_team(self):
        assert self.get_send_to_team(self.project, 900001) == {}

    def test_send_to_team(self):
        assert self.get_send_to_team() == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
        }

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

        assert self.get_send_to_team() == {}

    def test_send_to_team_direct(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )
        assert self.get_send_to_team() == {ExternalProviders.SLACK: {self.team}}

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            team=self.team,
        )
        assert self.get_send_to_team() == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)}
        }

    def test_other_project_team(self):
        user_2 = self.create_user()
        team_2 = self.create_team(self.organization, members=[user_2])
        project_2 = self.create_project(organization=self.organization, teams=[team_2])

        assert self.get_send_to_team(project_2, team_2.id) == {
            ExternalProviders.EMAIL: {user_service.get_user(user_2.id)},
            ExternalProviders.SLACK: {user_service.get_user(user_2.id)},
        }
        assert self.get_send_to_team(self.project, team_2.id) == {}

    def test_other_org_team(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        assert self.get_send_to_team(project_2, team_2.id) == {
            ExternalProviders.EMAIL: {user_service.get_user(user_2.id)},
            ExternalProviders.SLACK: {user_service.get_user(user_2.id)},
        }
        assert self.get_send_to_team(self.project, team_2.id) == {}


class GetSendToOwnersTest(TestCase):
    def get_send_to_owners(
        self, event: Event
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            self.project,
            target_type=ActionTargetType.ISSUE_OWNERS,
            target_identifier=None,
            event=event,
        )

    def store_event_owners(self, filename: str) -> Event:
        return super().store_event(data=make_event_data(filename), project_id=self.project.id)

    def setUp(self):
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.user3 = self.create_user(email="bar@example.com", is_active=True)
        self.user_suspect_committer = self.create_user(
            email="suspectcommitter@example.com", is_active=True
        )

        self.team2 = self.create_team(
            organization=self.organization, members=[self.user, self.user2]
        )
        self.team_suspect_committer = self.create_team(
            organization=self.organization, members=[self.user_suspect_committer]
        )
        self.project.add_team(self.team2)
        self.project.add_team(self.team_suspect_committer)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.py"), [Owner("team", self.team2.slug)]),
                    grammar.Rule(Matcher("path", "*.jsx"), [Owner("user", self.user.email)]),
                    grammar.Rule(Matcher("path", "*.jx"), [Owner("user", self.user3.email)]),
                    grammar.Rule(Matcher("path", "*.java"), [Owner("user", self.user.email)]),
                    grammar.Rule(
                        Matcher("path", "*.cbl"),
                        [
                            Owner("user", user.email)
                            for user in User.objects.filter(
                                id__in=self.project.member_set.values_list("user", flat=True)
                            )
                        ],
                    ),
                    grammar.Rule(Matcher("path", "*.lol"), []),
                ]
            ),
            fallthrough=True,
        )

        # turn off slack for teams
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            team=self.team2,
        )

        self.integration.add_organization(self.project.organization, self.user)

    def create_sample_commit(self, user: User) -> Commit:
        return self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.create_commit_author(project=self.project, user=user),
            key="a" * 40,
            message="fix: Fix bug",
        )

    def test_empty(self):
        event = self.store_event_owners("empty.lol")

        assert self.get_send_to_owners(event) == {}

    def test_single_user(self):
        event = self.store_event_owners("user.jsx")

        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)},
        }

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

        assert self.get_send_to_owners(event) == {
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)},
        }

    def test_single_user_no_teams(self):
        event = self.store_event_owners("user.jx")

        assert self.get_send_to_owners(event) == {}

    def test_team_owners(self):
        event = self.store_event_owners("team.py")

        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            },
        }

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )
        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
            ExternalProviders.SLACK: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            },
        }

    def test_disable_alerts_multiple_scopes(self):
        event = self.store_event_owners("everyone.cbl")

        # Project-independent setting.
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user2,
        )

        # Per-project setting.
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )

        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)},
        }

    def test_fallthrough(self):
        event = self.store_event_owners("no_rule.cpp")

        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
                user_service.get_user(self.user_suspect_committer.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
                user_service.get_user(self.user_suspect_committer.id),
            },
        }

    def test_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = self.store_event_owners("no_rule.cpp")

        assert self.get_send_to_owners(event) == {}

    @with_feature("organizations:streamline-targeting-context")
    def test_send_to_suspect_committers(self):
        """
        Test suspect committer is added as suggested assignee, where "organizations:commit-context"
        flag is not on.
        """
        # TODO: Delete this test once Commit Context has GA'd
        release = self.create_release(project=self.project, version="v12")
        event = self.store_event(
            data={
                "platform": "java",
                "stacktrace": STACKTRACE,
                "tags": {"sentry:release": release.version},
            },
            project_id=self.project.id,
        )
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "suspectcommitter@example.com",
                    "author_name": "Suspect Committer",
                    "message": "fix: Fix bug",
                    "patch_set": [
                        {"path": "src/main/java/io/sentry/example/Application.java", "type": "M"}
                    ],
                },
            ]
        )
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=release.id
        )

        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user_suspect_committer.id),
                user_service.get_user(self.user.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user_suspect_committer.id),
                user_service.get_user(self.user.id),
            },
        }

    @with_feature("organizations:streamline-targeting-context")
    @with_feature("organizations:commit-context")
    def test_send_to_suspect_committers_with_commit_context_feature_flag(self):
        """
        Test suspect committer is added as suggested assignee, where "organizations:commit-context"
        flag is on.
        """
        self.commit = self.create_sample_commit(self.user_suspect_committer)
        event = self.store_event(
            data={
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user_suspect_committer.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )
        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user_suspect_committer.id),
                user_service.get_user(self.user.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user_suspect_committer.id),
                user_service.get_user(self.user.id),
            },
        }

    @with_feature("organizations:streamline-targeting-context")
    @with_feature("organizations:commit-context")
    def test_send_to_suspect_committers_no_owners_with_commit_context_feature_flag(self):
        """
        Test suspect committer is added as suggested assignee, where no user owns the file and
        where the "organizations:commit-context" flag is on.
        """
        organization = self.create_organization(name="New Organization")
        project_suspect_committer = self.create_project(
            name="Suspect Committer Team Project",
            organization=organization,
            teams=[self.team_suspect_committer],
        )
        team_suspect_committer = self.create_team(
            organization=organization, members=[self.user_suspect_committer]
        )
        project_suspect_committer.add_team(team_suspect_committer)
        commit = self.create_sample_commit(self.user_suspect_committer)
        event = self.store_event(
            data={
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handledError",
                            "abs_path": "Application.lol",
                            "module": "io.sentry.example.Application",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "Application.lol",
                        },
                    ]
                },
            },
            project_id=project_suspect_committer.id,
        )

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user_suspect_committer.id,
            project=project_suspect_committer,
            organization=organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        assert get_send_to(
            project_suspect_committer,
            target_type=ActionTargetType.ISSUE_OWNERS,
            target_identifier=None,
            event=event,
        ) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user_suspect_committer.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user_suspect_committer.id),
            },
        }

    @with_feature("organizations:streamline-targeting-context")
    @with_feature("organizations:commit-context")
    def test_send_to_suspect_committers_dupe_with_commit_context_feature_flag(self):
        """
        Test suspect committer/owner is added as suggested assignee once where the suspect
        committer is also the owner and where the "organizations:commit-context" flag is on.
        """
        commit = self.create_sample_commit(self.user)
        event = self.store_event(
            data={
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {user_service.get_user(self.user.id)},
            ExternalProviders.SLACK: {user_service.get_user(self.user.id)},
        }

    @with_feature("organizations:streamline-targeting-context")
    @with_feature("organizations:commit-context")
    def test_send_to_suspect_committers_exception_with_commit_context_feature_flag(self):
        """
        Test determine_eligible_recipients throws an exception when get_suspect_committers throws
        an exception and returns the file owner, where "organizations:commit-context" flag is on.
        """
        invalid_commit_id = 10000
        event = self.store_event(
            data={
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user3.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": invalid_commit_id},
        )
        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user.id),
            },
        }

    @with_feature("organizations:streamline-targeting-context")
    @with_feature("organizations:commit-context")
    def test_send_to_suspect_committers_not_project_member_commit_context_feature_flag(self):
        """
        Test suspect committer is not added as suggested assignee where the suspect committer
         is not part of the project and where the "organizations:commit-context" flag is on.
        """
        user_suspect_committer_no_team = self.create_user(
            email="suspectcommitternoteam@example.com", is_active=True
        )
        commit = self.create_sample_commit(user_suspect_committer_no_team)
        event = self.store_event(
            data={
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )

        GroupOwner.objects.create(
            group=event.group,
            user_id=user_suspect_committer_no_team.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        assert self.get_send_to_owners(event) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
            },
            ExternalProviders.SLACK: {
                user_service.get_user(self.user.id),
            },
        }


class GetOwnersCase(TestCase):
    def setUp(self):
        self.user_1 = self.create_user(email="paul@atreides.space")
        self.user_2 = self.create_user(email="leto@atreides.space")
        self.user_3 = self.create_user(email="lady@jessica.space")
        self.organization = self.create_organization(name="Padishah Emperor")
        self.team_1 = self.create_team(
            organization=self.organization,
            name="House Atreides",
            members=[self.user_1, self.user_2],
        )
        self.team_2 = self.create_team(
            organization=self.organization, name="Bene Gesserit", members=[self.user_1, self.user_3]
        )
        self.project = self.create_project(
            name="Settle Arrakis", organization=self.organization, teams=[self.team_1, self.team_2]
        )
        self.rule_1 = Rule(Matcher("path", "*.js"), [Owner("team", self.team_1.slug)])
        self.rule_2 = Rule(Matcher("path", "*.js"), [Owner("team", self.team_2.slug)])
        self.rule_3 = Rule(Matcher("path", "*.js"), [Owner("user", self.user_1.email)])

    def tearDown(self):
        cache.delete(ProjectOwnership.get_cache_key(self.project.id))
        super().tearDown()

    def create_event(self, project: Project) -> Event:
        return self.store_event(
            data={
                "event_id": "0" * 32,
                "environment": "development",
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["part-1"],
                "stacktrace": {"frames": [{"filename": "flow/spice.js"}]},
            },
            project_id=project.id,
        )

    def create_ownership(
        self, project: Project, rules: Optional[Sequence[Rule]] = None, fallthrough: bool = False
    ) -> ProjectOwnership:
        return ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema(rules if rules else []),
            fallthrough=fallthrough,
        )

    def assert_recipients(
        self, expected: Iterable[Union[Team, User]], received: Iterable[Union[Team, RpcUser]]
    ) -> None:
        assert len(expected) == len(received)
        for recipient in expected:
            if isinstance(recipient, User):
                assert user_service.get_user(recipient.id) in received
            else:
                assert recipient in received

    # If no event to match, we assume fallthrough is enabled
    def test_get_owners_no_event(self):
        self.create_ownership(self.project)
        recipients = get_owners(project=self.project)
        self.assert_recipients(
            expected=[self.user_1, self.user_2, self.user_3], received=recipients
        )

    # If no match, and fallthrough is disabled
    def test_get_owners_empty(self):
        self.create_ownership(self.project)
        event = self.create_event(self.project)
        recipients = get_owners(project=self.project, event=event)
        self.assert_recipients(expected=[], received=recipients)

    # If no match, and fallthrough is enabled
    def test_get_owners_everyone(self):
        self.create_ownership(self.project, [], True)
        event = self.create_event(self.project)
        recipients = get_owners(project=self.project, event=event)
        self.assert_recipients(
            expected=[self.user_1, self.user_2, self.user_3], received=recipients
        )

    # If matched, and all-recipients flag
    def test_get_owners_match(self):
        with self.feature("organizations:notification-all-recipients"):
            self.create_ownership(self.project, [self.rule_1, self.rule_2, self.rule_3])
            event = self.create_event(self.project)
            recipients = get_owners(project=self.project, event=event)
            self.assert_recipients(
                expected=[self.team_1, self.team_2, self.user_1], received=recipients
            )

    # If matched, and no all-recipients flag
    def test_get_owners_single_participant(self):
        self.create_ownership(self.project, [self.rule_1, self.rule_2, self.rule_3])
        event = self.create_event(self.project)
        recipients = get_owners(project=self.project, event=event)
        self.assert_recipients(expected=[self.user_1], received=recipients)

    # If matched, we don't look at the fallthrough flag
    def test_get_owners_match_ignores_fallthrough(self):
        self.create_ownership(self.project, [self.rule_1, self.rule_2, self.rule_3], True)
        event_2 = self.create_event(self.project)
        recipients_2 = get_owners(project=self.project, event=event_2)
        self.assert_recipients(expected=[self.user_1], received=recipients_2)

    def test_get_owner_reason(self):
        self.create_ownership(self.project, [], True)
        event = self.create_event(self.project)
        owner_reason = get_owner_reason(
            project=self.project,
            event=event,
            target_type=ActionTargetType.ISSUE_OWNERS,
            fallthrough_choice=FallthroughChoiceType.ALL_MEMBERS,
        )
        assert (
            owner_reason
            == f"We notified all members in the {self.project.get_full_name()} project of this issue"
        )
        owner_reason = get_owner_reason(
            project=self.project,
            event=event,
            target_type=ActionTargetType.ISSUE_OWNERS,
            fallthrough_choice=FallthroughChoiceType.ACTIVE_MEMBERS,
        )
        assert (
            owner_reason
            == f"We notified recently active members in the {self.project.get_full_name()} project of this issue"
        )

    def test_get_owner_reason_member(self):
        self.create_ownership(self.project, [], True)
        event = self.create_event(self.project)
        owner_reason = get_owner_reason(
            project=self.project,
            target_type=ActionTargetType.MEMBER,
            event=event,
            fallthrough_choice=FallthroughChoiceType.ALL_MEMBERS,
        )
        assert owner_reason is None


class GetSendToFallthroughTest(TestCase):
    def get_send_to_fallthrough(
        self,
        event: Event,
        project: Project,
        fallthrough_choice: Optional[FallthroughChoiceType] = None,
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            project,
            target_type=ActionTargetType.ISSUE_OWNERS,
            target_identifier=None,
            event=event,
            fallthrough_choice=fallthrough_choice,
        )

    def store_event(self, filename: str, project: Project) -> Event:
        return super().store_event(data=make_event_data(filename), project_id=project.id)

    def setUp(self):
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.user3 = self.create_user(email="bar@example.com", is_active=True)

        self.team2 = self.create_team(
            organization=self.organization, members=[self.user, self.user2]
        )
        self.project.add_team(self.team2)

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.py"), [Owner("team", self.team2.slug)]),
                    # *.lol paths should trigger the fallthrough logic
                    grammar.Rule(Matcher("path", "*.lol"), []),
                ]
            ),
            # test with fallthrough off to ensure the new fallthrough logic is used
            fallthrough=False,
        )

        # turn off slack for teams
        for user in [self.user, self.user2, self.user3]:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=user,
            )

    def test_feature_off_no_owner(self):
        event = self.store_event("empty.lol", self.project)
        assert get_fallthrough_recipients(self.project, FallthroughChoiceType.ACTIVE_MEMBERS) == []
        assert self.get_send_to_fallthrough(event, self.project, None) == {}

    def test_feature_off_with_owner(self):
        event = self.store_event("empty.py", self.project)
        assert self.get_send_to_fallthrough(event, self.project, None,) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            },
        }

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_invalid_fallthrough_choice(self):
        with pytest.raises(NotImplementedError) as e:
            get_fallthrough_recipients(self.project, "invalid")
            assert e.value.startswith("Invalid fallthrough choice: invalid")

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_setting_on(self):
        """
        Test that the new fallthrough choice takes precedence even if the fallthrough setting is on.
        """
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=True)

        event = self.store_event("empty.lol", self.project)
        assert self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ALL_MEMBERS
        ) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            },
        }

        event = self.store_event("empty.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.NO_ONE) == {}

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_no_fallthrough(self):
        """
        Test the new fallthrough choice when no fallthrough choice is provided."""
        event = self.store_event("none.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, fallthrough_choice=None) == {}

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_no_owners(self):
        """
        Test the fallthrough when there is no ProjectOwnership set.
        """
        event = self.store_event("empty.unknown", self.project)
        with pytest.raises(AttributeError) as e:
            self.get_send_to_fallthrough(event, FallthroughChoiceType.ALL_MEMBERS, self.project)
            assert e.value.startswith("Tried to send notification to invalid project")

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_no_one(self):
        event = self.store_event("empty.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.NO_ONE) == {}

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_all_members_no_owner(self):
        empty_project = self.create_project(organization=self.organization)
        ProjectOwnership.objects.create(
            project_id=empty_project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.lol"), []),
                ]
            ),
            fallthrough=False,
        )

        event = self.store_event("empty.lol", empty_project)
        assert self.get_send_to_fallthrough(
            event, empty_project, FallthroughChoiceType.ALL_MEMBERS
        ) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
            }
        }

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_all_members_multiple_teams(self):
        team3 = self.create_team(organization=self.organization, members=[self.user2, self.user3])
        self.project.add_team(team3)

        event = self.store_event("admin.lol", self.project)
        assert self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ALL_MEMBERS
        ) == {
            ExternalProviders.EMAIL: {
                user_service.get_user(self.user.id),
                user_service.get_user(self.user2.id),
                user_service.get_user(self.user3.id),
            }
        }

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_admin_or_recent_inactive_users(self):
        notified_users = [self.user, self.user2]
        for i in range(2):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=False)
            notified_users.append(new_user)
        new_team = self.create_team(organization=self.organization, members=notified_users)
        self.project.add_team(new_team)

        for user in notified_users:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=user,
            )

        event = self.store_event("admin.lol", self.project)
        # Check that the notified users are only the 2 active users.
        expected_notified_users = {
            user_service.get_user(user.id) for user in [self.user, self.user2]
        }
        assert self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS
        ) == {ExternalProviders.EMAIL: expected_notified_users}

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_admin_or_recent_under_20(self):
        notifiable_users = [self.user, self.user2]
        for i in range(10):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=True)
            self.create_member(
                user=new_user, organization=self.organization, role="owner", teams=[self.team2]
            )
            notifiable_users.append(new_user)

        for user in notifiable_users:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=user,
            )

        event = self.store_event("admin.lol", self.project)
        expected_notified_users = {user_service.get_user(user.id) for user in notifiable_users}
        notified_users = self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS
        )[ExternalProviders.EMAIL]

        assert len(notified_users) == 12
        assert notified_users == expected_notified_users

    @with_feature("organizations:issue-alert-fallback-targeting")
    def test_fallthrough_admin_or_recent_over_20(self):
        notifiable_users = [self.user, self.user2]
        for i in range(FALLTHROUGH_NOTIFICATION_LIMIT_EA + 5):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=True)
            self.create_member(
                user=new_user, organization=self.organization, role="owner", teams=[self.team2]
            )
            notifiable_users.append(new_user)

        for user in notifiable_users:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=user,
            )

        event = self.store_event("admin.lol", self.project)
        expected_notified_users = {user_service.get_user(user.id) for user in notifiable_users}
        notified_users = self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS
        )[ExternalProviders.EMAIL]

        assert len(notified_users) == FALLTHROUGH_NOTIFICATION_LIMIT_EA
        assert notified_users.issubset(expected_notified_users)
