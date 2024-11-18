from __future__ import annotations

import collections
from collections.abc import Iterable, Mapping, Sequence
from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.eventstore.models import Event
from sentry.integrations.types import ExternalProviders
from sentry.models.commit import Commit
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.repository import Repository
from sentry.models.team import Team
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import (
    ActionTargetType,
    FallthroughChoiceType,
    NotificationSettingEnum,
)
from sentry.notifications.utils.participants import (
    FALLTHROUGH_NOTIFICATION_LIMIT,
    get_fallthrough_recipients,
    get_owner_reason,
    get_owners,
    get_send_to,
)
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import link_team
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from tests.sentry.mail import make_event_data

pytestmark = [requires_snuba]

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


class _ParticipantsTest(TestCase):
    def assert_recipients_are(
        self,
        actual: Mapping[ExternalProviders, set[Actor]],
        *,
        email: Iterable[int] = (),
        slack: Iterable[int] = (),
    ) -> None:
        expected: dict[ExternalProviders, set[Actor]] = collections.defaultdict(set)
        for provider, user_ids in [
            (ExternalProviders.EMAIL, email),
            (ExternalProviders.SLACK, slack),
        ]:
            if user_ids:
                for user_id in user_ids:
                    user = user_service.get_user(user_id)
                    assert user is not None
                    expected[provider].add(Actor.from_rpc_user(user))
        assert actual == expected


class GetSendToMemberTest(_ParticipantsTest):
    def get_send_to_member(
        self, project: Project | None = None, user_id: int | None = None
    ) -> Mapping[ExternalProviders, set[Actor]]:
        return get_send_to(
            project=project or self.project,
            target_type=ActionTargetType.MEMBER,
            target_identifier=user_id or self.user.id,
        )

    def test_invalid_user(self):
        assert self.get_send_to_member(self.project, 900001) == {}

    def test_send_to_user(self):
        self.assert_recipients_are(
            self.get_send_to_member(), email=[self.user.id], slack=[self.user.id]
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="email",
                type="alerts",
                value="never",
            )

        self.assert_recipients_are(self.get_send_to_member(), slack=[self.user.id])

    def test_other_org_user(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        team_3 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2, team_3])

        self.assert_recipients_are(
            self.get_send_to_member(project_2, user_2.id), email=[user_2.id], slack=[user_2.id]
        )
        assert self.get_send_to_member(self.project, user_2.id) == {}

    def test_no_project_access(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        user_3 = self.create_user()
        self.create_team(org_2, members=[user_3])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        self.assert_recipients_are(
            self.get_send_to_member(project_2, user_2.id), email=[user_2.id], slack=[user_2.id]
        )
        assert self.get_send_to_member(self.project, user_3.id) == {}


class GetSendToTeamTest(_ParticipantsTest):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="never",
            )
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="slack",
                type="alerts",
                value="never",
            )
            NotificationSettingOption.objects.all().delete()

    def get_send_to_team(
        self, project: Project | None = None, team_id: int | None = None
    ) -> Mapping[ExternalProviders, set[Actor]]:
        return get_send_to(
            project=project or self.project,
            target_type=ActionTargetType.TEAM,
            target_identifier=team_id or self.team.id,
        )

    def test_invalid_team(self):
        assert self.get_send_to_team(self.project, 900001) == {}

    def test_send_to_team(self):
        self.assert_recipients_are(self.get_send_to_team(), email=[self.user.id])

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="email",
                type="alerts",
                value="never",
            )

        assert self.get_send_to_team() == {}

    def test_send_to_team_direct(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.filter(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
            ).update(value="always")
        assert self.get_send_to_team() == {
            ExternalProviders.SLACK: {Actor.from_orm_team(self.team)}
        }

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="never",
            )
        self.assert_recipients_are(self.get_send_to_team(), email=[self.user.id])

    @with_feature("organizations:team-workflow-notifications")
    def test_send_workflow_to_team_direct(self):
        link_team(self.team, self.integration, "#team-channel", "team_channel_id")
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="workflow",
                value="always",
            )

        assert get_send_to(
            project=self.project,
            target_type=ActionTargetType.TEAM,
            target_identifier=self.team.id,
            notification_type_enum=NotificationSettingEnum.WORKFLOW,
        ) == {
            ExternalProviders.SLACK: {Actor.from_orm_team(self.team)},
        }

    def test_other_project_team(self):
        user_2 = self.create_user()
        team_2 = self.create_team(self.organization, members=[user_2])
        project_2 = self.create_project(organization=self.organization, teams=[team_2])

        self.assert_recipients_are(
            self.get_send_to_team(project_2, team_2.id), email=[user_2.id], slack=[user_2.id]
        )
        assert self.get_send_to_team(self.project, team_2.id) == {}

    def test_other_org_team(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        self.assert_recipients_are(
            self.get_send_to_team(project_2, team_2.id), email=[user_2.id], slack=[user_2.id]
        )
        assert self.get_send_to_team(self.project, team_2.id) == {}


class GetSendToOwnersTest(_ParticipantsTest):
    def get_send_to_owners(self, event: Event) -> Mapping[ExternalProviders, set[Actor]]:
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

        user_ids = list(self.project.member_set.values_list("user_id", flat=True))
        with assume_test_silo_mode(SiloMode.CONTROL):
            users = [Owner("user", user.email) for user in User.objects.filter(id__in=user_ids)]
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
                        users,
                    ),
                    grammar.Rule(Matcher("path", "*.lol"), []),
                ]
            ),
            fallthrough=True,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
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

        self.assert_recipients_are(
            self.get_send_to_owners(event), email=[self.user.id], slack=[self.user.id]
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Make sure that disabling mail alerts works as expected
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="email",
                type="alerts",
                value="never",
            )
        self.assert_recipients_are(self.get_send_to_owners(event), slack=[self.user.id])

    def test_single_user_no_teams(self):
        event = self.store_event_owners("user.jx")

        assert self.get_send_to_owners(event) == {}

    def test_team_owners(self):
        event = self.store_event_owners("team.py")

        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user.id, self.user2.id],
            slack=[self.user.id, self.user2.id],
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            # disable alerts on the project
            NotificationSettingOption.objects.create(
                user_id=self.user2.id,
                scope_type="project",
                scope_identifier=self.project.id,
                type="alerts",
                value="never",
            )
        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user.id],
            slack=[self.user.id],
        )

    def test_disable_alerts_multiple_scopes(self):
        event = self.store_event_owners("everyone.cbl")

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Project-independent setting.
            NotificationSettingOption.objects.create(
                user_id=self.user2.id,
                scope_type="user",
                scope_identifier=self.user2.id,
                type="alerts",
                value="always",
            )

            # Per-project setting.
            NotificationSettingOption.objects.create(
                user_id=self.user2.id,
                scope_type="project",
                scope_identifier=self.project.id,
                type="alerts",
                value="never",
            )

        self.assert_recipients_are(
            self.get_send_to_owners(event), email=[self.user.id], slack=[self.user.id]
        )

    def test_no_fallthrough(self):
        event = self.store_event_owners("no_rule.cpp")

        self.assert_recipients_are(self.get_send_to_owners(event), email=[], slack=[])

    def test_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = self.store_event_owners("no_rule.cpp")

        assert self.get_send_to_owners(event) == {}

    def test_send_to_current_assignee_team(self):
        """
        Test the current issue assignee is notified
        """
        event = self.store_event(
            data={
                "platform": "java",
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )
        team = self.create_team(organization=self.organization, members=[self.user])
        assert event.group is not None
        GroupAssignee.objects.create(
            group=event.group,
            project=event.group.project,
            team_id=team.id,
            date_added=timezone.now(),
        )

        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user.id],
            slack=[self.user.id],
        )

    def test_send_to_current_assignee_user(self):
        """
        Test the current issue assignee is notified
        """
        event = self.store_event(
            data={
                "platform": "java",
                "stacktrace": STACKTRACE,
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        GroupAssignee.objects.create(
            group=event.group,
            project=event.group.project,
            user_id=self.user.id,
            date_added=timezone.now(),
        )

        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user.id],
            slack=[self.user.id],
        )

    def test_send_to_current_assignee_and_owners(self):
        """
        We currently send to both the current assignee and issue owners.
        In the future we might consider only sending to the assignee.
        """
        member = self.create_user(email="member@example.com", is_active=True)
        event = self.store_event_owners("team.py")
        assert event.group is not None
        GroupAssignee.objects.create(
            group=event.group,
            project=event.group.project,
            user_id=member.id,
            date_added=timezone.now(),
        )

        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user.id, self.user2.id, member.id],
            slack=[self.user.id, self.user2.id, member.id],
        )

    def test_send_to_suspect_committers(self):
        """
        Test suspect committer is added as suggested assignee
        """
        self.commit = self.create_sample_commit(self.user_suspect_committer)
        event = self.store_event(
            data={"stacktrace": STACKTRACE},
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user_suspect_committer.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )
        self.assert_recipients_are(
            self.get_send_to_owners(event),
            email=[self.user_suspect_committer.id, self.user.id],
            slack=[self.user_suspect_committer.id, self.user.id],
        )

    def test_send_to_suspect_committers_no_owners(self):
        """
        Test suspect committer is added as suggested assignee, where no user owns the file
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
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user_suspect_committer.id,
            project=project_suspect_committer,
            organization=organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        self.assert_recipients_are(
            get_send_to(
                project_suspect_committer,
                target_type=ActionTargetType.ISSUE_OWNERS,
                target_identifier=None,
                event=event,
            ),
            email=[self.user_suspect_committer.id],
            slack=[self.user_suspect_committer.id],
        )

    def test_send_to_suspect_committers_dupe(self):
        """
        Test suspect committer/owner is added as suggested assignee once where the suspect
        committer is also the owner.
        """
        commit = self.create_sample_commit(self.user)
        event = self.store_event(
            data={"stacktrace": STACKTRACE},
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        self.assert_recipients_are(
            self.get_send_to_owners(event), email=[self.user.id], slack=[self.user.id]
        )

    def test_send_to_suspect_committers_exception(self):
        """
        Test determine_eligible_recipients throws an exception when get_suspect_committers throws
        an exception and returns the file owner
        """
        invalid_commit_id = 10000
        event = self.store_event(
            data={"stacktrace": STACKTRACE},
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user3.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": invalid_commit_id},
        )
        self.assert_recipients_are(
            self.get_send_to_owners(event), email=[self.user.id], slack=[self.user.id]
        )

    def test_send_to_suspect_committers_not_project_member(self):
        """
        Test suspect committer is not added as suggested assignee where the suspect committer
         is not part of the project
        """
        user_suspect_committer_no_team = self.create_user(
            email="suspectcommitternoteam@example.com", is_active=True
        )
        commit = self.create_sample_commit(user_suspect_committer_no_team)
        event = self.store_event(
            data={"stacktrace": STACKTRACE},
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=user_suspect_committer_no_team.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        self.assert_recipients_are(
            self.get_send_to_owners(event), email=[self.user.id], slack=[self.user.id]
        )


class GetOwnersCase(_ParticipantsTest):
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
                "timestamp": before_now(days=1).isoformat(),
                "fingerprint": ["part-1"],
                "stacktrace": {"frames": [{"filename": "flow/spice.js"}]},
            },
            project_id=project.id,
        )

    def create_ownership(
        self, project: Project, rules: Sequence[Rule] | None = None, fallthrough: bool = False
    ) -> ProjectOwnership:
        return ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema(rules if rules else []),
            fallthrough=fallthrough,
        )

    def assert_recipients(self, expected: Iterable[Team | User], received: Iterable[Actor]) -> None:
        assert {Actor.from_object(recipient) for recipient in expected} == set(received)

    # If no event to match, we assume fallthrough is enabled
    def test_get_owners_no_event(self):
        self.create_ownership(self.project)
        recipients, outcome = get_owners(project=self.project)
        self.assert_recipients(
            expected=[self.user_1, self.user_2, self.user_3], received=recipients
        )
        assert outcome == "everyone"

    # If no match, and fallthrough is disabled
    def test_get_owners_empty(self):
        self.create_ownership(self.project)
        event = self.create_event(self.project)
        recipients, outcome = get_owners(project=self.project, event=event)
        self.assert_recipients(expected=[], received=recipients)
        assert outcome == "empty"

    # If no match, and fallthrough is still ignored
    def test_get_owners_fallthrough_ignored(self):
        self.create_ownership(self.project, [], True)
        event = self.create_event(self.project)
        recipients, outcome = get_owners(project=self.project, event=event)
        self.assert_recipients(expected=[], received=recipients)
        assert outcome == "empty"

    # If matched, and no all-recipients flag
    def test_get_owners_single_participant(self):
        self.create_ownership(self.project, [self.rule_1, self.rule_2, self.rule_3])
        event = self.create_event(self.project)
        recipients, outcome = get_owners(project=self.project, event=event)
        self.assert_recipients(expected=[self.user_1], received=recipients)
        assert outcome == "match"

    # If matched, we don't look at the fallthrough flag
    def test_get_owners_match_ignores_fallthrough(self):
        self.create_ownership(self.project, [self.rule_1, self.rule_2, self.rule_3], True)
        event_2 = self.create_event(self.project)
        recipients_2, outcome = get_owners(project=self.project, event=event_2)
        self.assert_recipients(expected=[self.user_1], received=recipients_2)
        assert outcome == "match"

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


class GetSendToFallthroughTest(_ParticipantsTest):
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            for user in [self.user, self.user2, self.user3]:
                NotificationSettingProvider.objects.create(
                    user_id=user.id,
                    scope_type="user",
                    scope_identifier=user.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )
        with assume_test_silo_mode(SiloMode.CONTROL):
            # disable Slack
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="never",
            )
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="slack",
                type="alerts",
                value="never",
            )
            NotificationSettingOption.objects.all().delete()

    def get_send_to_fallthrough(
        self,
        event: Event,
        project: Project,
        fallthrough_choice: FallthroughChoiceType | None = None,
    ) -> Mapping[ExternalProviders, set[Actor]]:
        return get_send_to(
            project,
            target_type=ActionTargetType.ISSUE_OWNERS,
            target_identifier=None,
            event=event,
            fallthrough_choice=fallthrough_choice,
        )

    def store_event(self, filename: str, project: Project) -> Event:
        return super().store_event(data=make_event_data(filename), project_id=project.id)

    def test_invalid_fallthrough_choice(self):
        with pytest.raises(NotImplementedError) as e:
            get_fallthrough_recipients(self.project, "invalid")  # type: ignore[arg-type]
        assert str(e.value).startswith("Unknown fallthrough choice: invalid")

    def test_fallthrough_setting_on(self):
        """
        Test that the new fallthrough choice takes precedence even if the fallthrough setting is on.
        """
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=True)

        event = self.store_event("empty.lol", self.project)
        self.assert_recipients_are(
            self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.ALL_MEMBERS),
            email=[self.user.id, self.user2.id],
        )

        event = self.store_event("empty.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.NO_ONE) == {}

    def test_no_fallthrough(self):
        """
        Test the new fallthrough choice when no fallthrough choice is provided."""
        event = self.store_event("none.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, fallthrough_choice=None) == {}

    def test_no_owners(self):
        """
        Test the fallthrough when there is no ProjectOwnership set.
        """
        project_without_team = self.create_project(
            name="no-teams", teams=None, organization=self.organization
        )
        event = self.store_event("empty.unknown", project_without_team)
        ret = self.get_send_to_fallthrough(
            event, project_without_team, FallthroughChoiceType.ALL_MEMBERS
        )
        assert ret == {}

    def test_fallthrough_no_one(self):
        event = self.store_event("empty.lol", self.project)
        assert self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.NO_ONE) == {}

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
        self.assert_recipients_are(
            self.get_send_to_fallthrough(event, empty_project, FallthroughChoiceType.ALL_MEMBERS),
            email=[self.user.id, self.user2.id],
        )

    def test_fallthrough_all_members_multiple_teams(self):
        team3 = self.create_team(organization=self.organization, members=[self.user2, self.user3])
        self.project.add_team(team3)

        event = self.store_event("admin.lol", self.project)
        self.assert_recipients_are(
            self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.ALL_MEMBERS),
            email=[self.user.id, self.user2.id, self.user3.id],
        )

    def test_fallthrough_admin_or_recent_inactive_users(self):
        notified_users = [self.user, self.user2]
        for i in range(2):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=False)
            notified_users.append(new_user)
        new_team = self.create_team(organization=self.organization, members=notified_users)
        self.project.add_team(new_team)

        with assume_test_silo_mode(SiloMode.CONTROL):
            for user in notified_users:
                NotificationSettingProvider.objects.create(
                    user_id=user.id,
                    scope_type="user",
                    scope_identifier=user.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )

        event = self.store_event("admin.lol", self.project)
        # Check that the notified users are only the 2 active users.
        self.assert_recipients_are(
            self.get_send_to_fallthrough(event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS),
            email=[user.id for user in [self.user, self.user2]],
        )

    def test_fallthrough_admin_or_recent_under_20(self):
        notifiable_users = [self.user, self.user2]
        for i in range(10):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=True)
            self.create_member(
                user=new_user, organization=self.organization, role="owner", teams=[self.team2]
            )
            notifiable_users.append(new_user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            for user in notifiable_users:
                NotificationSettingProvider.objects.create(
                    user_id=user.id,
                    scope_type="user",
                    scope_identifier=user.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )

        event = self.store_event("admin.lol", self.project)
        expected_notified_users = {Actor.from_orm_user(user) for user in notifiable_users}
        notified_users = self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS
        )[ExternalProviders.EMAIL]

        assert len(notified_users) == 12
        assert notified_users == expected_notified_users

    def test_fallthrough_admin_or_recent_over_20(self):
        notifiable_users = [self.user, self.user2]
        for i in range(FALLTHROUGH_NOTIFICATION_LIMIT + 5):
            new_user = self.create_user(email=f"user_{i}@example.com", is_active=True)
            self.create_member(
                user=new_user, organization=self.organization, role="owner", teams=[self.team2]
            )
            notifiable_users.append(new_user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            for user in notifiable_users:
                NotificationSettingProvider.objects.create(
                    user_id=user.id,
                    scope_type="user",
                    scope_identifier=user.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )

        event = self.store_event("admin.lol", self.project)
        expected_notified_users = {Actor.from_orm_user(user) for user in notifiable_users}
        notified_users = self.get_send_to_fallthrough(
            event, self.project, FallthroughChoiceType.ACTIVE_MEMBERS
        )[ExternalProviders.EMAIL]

        assert len(notified_users) == FALLTHROUGH_NOTIFICATION_LIMIT
        assert notified_users.issubset(expected_notified_users)

    def test_fallthrough_recipients_active_member_ordering(self):
        present = timezone.now()

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.last_active = present - timedelta(days=1)
            self.user.save()

            self.user2.last_active = present - timedelta(days=10)
            self.user2.save()

        recipients = list(
            get_fallthrough_recipients(self.project, FallthroughChoiceType.ACTIVE_MEMBERS)
        )

        assert len(recipients) == 2
        assert recipients[0].id == self.user.id
        assert recipients[1].id == self.user2.id
