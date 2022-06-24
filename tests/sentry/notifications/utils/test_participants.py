from typing import Iterable, Mapping, Optional, Sequence, Union
from unittest import mock

from sentry.eventstore.models import Event
from sentry.models import GroupRelease, NotificationSetting, Project, ProjectOwnership, Team, User
from sentry.notifications.types import (
    ActionTargetType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils.participants import get_owners, get_release_committers, get_send_to
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.integrations import ExternalProviders
from sentry.utils.cache import cache
from tests.sentry.mail import make_event_data


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
        assert self.get_send_to_member() == {ExternalProviders.EMAIL: {self.user}}

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

        assert self.get_send_to_member() == {}

    def test_other_org_user(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        team_3 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2, team_3])

        assert self.get_send_to_member(project_2, user_2.id) == {ExternalProviders.EMAIL: {user_2}}
        assert self.get_send_to_member(self.project, user_2.id) == {}

    def test_no_project_access(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        user_3 = self.create_user()
        self.create_team(org_2, members=[user_3])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        assert self.get_send_to_member(project_2, user_2.id) == {ExternalProviders.EMAIL: {user_2}}
        assert self.get_send_to_member(self.project, user_3.id) == {}


class GetSendToTeamTest(TestCase):
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
        assert self.get_send_to_team() == {ExternalProviders.EMAIL: {self.user}}

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
        assert self.get_send_to_team() == {ExternalProviders.EMAIL: {self.user}}

    def test_other_project_team(self):
        user_2 = self.create_user()
        team_2 = self.create_team(self.organization, members=[user_2])
        project_2 = self.create_project(organization=self.organization, teams=[team_2])

        assert self.get_send_to_team(project_2, team_2.id) == {ExternalProviders.EMAIL: {user_2}}
        assert self.get_send_to_team(self.project, team_2.id) == {}

    def test_other_org_team(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2])

        assert self.get_send_to_team(project_2, team_2.id) == {ExternalProviders.EMAIL: {user_2}}
        assert self.get_send_to_team(self.project, team_2.id) == {}


class GetSentToReleaseMembersTest(TestCase):
    def get_send_to_release_members(
        self, event: Event
    ) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            self.project,
            target_type=ActionTargetType.RELEASE_MEMBERS,
            target_identifier=None,
            event=event,
        )

    def store_event(self, filename: str) -> Event:
        return super().store_event(data=make_event_data(filename), project_id=self.project.id)

    def setUp(self):
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.user3 = self.create_user(email="bar@example.com", is_active=True)

        self.team2 = self.create_team(
            organization=self.organization, members=[self.user, self.user2]
        )
        self.project.add_team(self.team2)
        release = self.create_release(project=self.project, user=self.user)
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=self.group.id,
            release_id=release.id,
            environment=self.environment.name,
        )

    @mock.patch(
        "sentry.notifications.utils.participants.get_release_committers",
        wraps=get_release_committers,
    )
    def test_default_committer(self, spy_get_release_committers):
        event = self.store_event("empty.lol")
        event.group = self.group
        with self.feature("organizations:active-release-notification-opt-in"):
            assert self.get_send_to_release_members(event) == {ExternalProviders.EMAIL: {self.user}}
            assert spy_get_release_committers.call_count == 1

    @mock.patch(
        "sentry.notifications.utils.participants.get_release_committers",
        wraps=get_release_committers,
    )
    def test_flag_off_should_no_release_members(self, spy_get_release_committers):
        event = self.store_event("empty.lol")
        event.group = self.group
        assert not self.get_send_to_release_members(event)
        assert spy_get_release_committers.call_count == 1


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

    def store_event(self, filename: str) -> Event:
        return super().store_event(data=make_event_data(filename), project_id=self.project.id)

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
                    grammar.Rule(Matcher("path", "*.jsx"), [Owner("user", self.user.email)]),
                    grammar.Rule(Matcher("path", "*.jx"), [Owner("user", self.user3.email)]),
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

    def test_empty(self):
        event = self.store_event("empty.lol")

        assert self.get_send_to_owners(event) == {}

    def test_single_user(self):
        event = self.store_event("user.jsx")

        assert self.get_send_to_owners(event) == {ExternalProviders.EMAIL: {self.user}}

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

        assert self.get_send_to_owners(event) == {}

    def test_single_user_no_teams(self):
        event = self.store_event("user.jx")

        assert self.get_send_to_owners(event) == {}

    def test_team_owners(self):
        event = self.store_event("team.py")

        assert self.get_send_to_owners(event) == {ExternalProviders.EMAIL: {self.user, self.user2}}

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )
        assert self.get_send_to_owners(event) == {ExternalProviders.EMAIL: {self.user}}

    def test_disable_alerts_multiple_scopes(self):
        event = self.store_event("everyone.cbl")

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

        assert self.get_send_to_owners(event) == {ExternalProviders.EMAIL: {self.user}}

    def test_fallthrough(self):
        event = self.store_event("no_rule.cpp")

        assert self.get_send_to_owners(event) == {ExternalProviders.EMAIL: {self.user, self.user2}}

    def test_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = self.store_event("no_rule.cpp")

        assert self.get_send_to_owners(event) == {}


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
        self, expected: Iterable[Union[Team, User]], received: Iterable[Union[Team, User]]
    ) -> None:
        assert len(expected) == len(received)
        for recipient in expected:
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
