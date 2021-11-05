from typing import Iterable, Mapping, Optional, Union

from sentry.eventstore.models import Event
from sentry.models import NotificationSetting, Project, ProjectOwnership, Team, User
from sentry.notifications.types import (
    ActionTargetType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils.participants import get_send_to
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders
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


class ParticipantsTestCase(TestCase):
    def setUp(self):
        self.organzation = self.create_organization(name="Padishah Emperor", owner=None)
        self.user = self.create_user(email="paul@atreides.space")
        self.team_1 = self.create_team(organization=self.organization, name="House Atreides")
        self.team_2 = self.create_team(organization=self.organization, name="Bene Gesserit")
        self.project1 = self.create_project(
            name="Settle Arrakis", organization=self.organization, teams=[self.team1, self.team2]
        )
        self.project2 = self.create_project(name="Survive", organization=self.organization)
        rule1 = Rule(Matcher("path", "*"), [Owner("user", self.user.email)])
        rule2 = Rule(Matcher("path", "*.py"), [Owner("team", self.team1.slug)])
        rule3 = Rule(Matcher("path", "magic/*.js"), [Owner("team", self.team2.slug)])

        self.project_ownership1 = ProjectOwnership.objects.create(
            project_id=self.project1.id, schema=dump_schema([rule1, rule2, rule3]), fallthrough=True
        )
        self.project_ownership2 = ProjectOwnership.objects.create(
            project_id=self.project2.id, fallthrough=True
        )

    def test_get_owners_no_event(self):
        pass

    def test_get_owners_empty(self):
        pass

    def test_get_owners_everyone(self):
        pass

    def test_get_owners_match(self):
        pass

    def test_only_autoassignee(self):
        pass
