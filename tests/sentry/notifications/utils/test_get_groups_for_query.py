from sentry.models import Group, Organization, Project
from sentry.notifications.helpers import get_groups_for_query
from sentry.notifications.types import NotificationScopeType, NotificationSettingOptionValues
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class GetGroupsForQueryTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_get_groups_for_query_empty(self):
        groups_by_project = {self.project: {self.group}}
        notification_settings_by_scope = {
            NotificationScopeType.PROJECT: {
                self.project.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                },
            },
        }

        assert (
            get_groups_for_query(
                groups_by_project={}, notification_settings_by_scope={}, user=self.user
            )
            == set()
        )
        assert get_groups_for_query(
            groups_by_project, notification_settings_by_scope={}, user=self.user
        ) == {self.group}
        assert (
            get_groups_for_query(
                groups_by_project={},
                notification_settings_by_scope=notification_settings_by_scope,
                user=self.user,
            )
            == set()
        )

    def test_get_groups_for_query(self):
        organization = Organization(id=1, slug="organization", name="My Company")
        project_0 = Project(id=100, organization=organization)
        project_1 = Project(id=101, organization=organization)
        project_2 = Project(id=102, organization=organization)

        groups_by_project = {
            project_0: {Group(id=10, project=project_0), Group(id=11, project=project_0)},
            project_1: {Group(id=12, project=project_0)},
            project_2: {Group(id=13, project=project_0)},
        }

        notification_settings_by_scope = {
            NotificationScopeType.PROJECT: {
                project_0.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                },
                project_1.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            }
        }
        query_groups = get_groups_for_query(
            groups_by_project, notification_settings_by_scope, user=self.user
        )
        assert {group.id for group in query_groups} == {10, 11, 13}

    def test_get_groups_for_query_simple(self):
        assert get_groups_for_query(
            {self.project: {self.group}},
            {
                NotificationScopeType.PROJECT: {
                    self.project.id: {
                        ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                        ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    },
                },
            },
            user=self.user,
        ) == {self.group}

    def test_get_groups_for_query_never(self):
        assert (
            get_groups_for_query(
                {self.project: {self.group}},
                {
                    NotificationScopeType.PROJECT: {
                        self.project.id: {
                            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                            ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                        },
                    },
                },
                user=self.user,
            )
            == set()
        )
