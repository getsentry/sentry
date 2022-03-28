from __future__ import annotations

__all__ = (
    "AcceptanceTestCase",
    "ActivityTestCase",
    "APITestCase",
    "AuthProviderTestCase",
    "BaseIncidentsTest",
    "BaseTestCase",
    "CliTestCase",
    "IntegrationRepositoryTestCase",
    "IntegrationTestCase",
    "MetricsAPIBaseTestCase",
    "MetricsEnhancedPerformanceTestCase",
    "OrganizationDashboardWidgetTestCase",
    "OrganizationMetricMetaIntegrationTestCase",
    "OutcomesSnubaTest",
    "PermissionTestCase",
    "PluginTestCase",
    "ReleaseCommitPatchTest",
    "RuleTestCase",
    "SCIMAzureTestCase",
    "SCIMTestCase",
    "SessionMetricsTestCase",
    "SetRefsTestCase",
    "SlackActivityNotificationTest",
    "SnubaTestCase",
    "TestCase",
    "TransactionTestCase",
    "TwoFactorAPITestCase",
)

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from exam import fixture

from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    Repository,
)
from sentry.utils.compat import zip

from .acceptance import AcceptanceTestCase
from .api import APITestCase
from .auth import (
    AuthProviderTestCase,
    PermissionTestCase,
    SCIMAzureTestCase,
    SCIMTestCase,
    TwoFactorAPITestCase,
)
from .base import BaseTestCase, TestCase, TransactionTestCase
from .cli import CliTestCase
from .integrations import (
    ActivityTestCase,
    IntegrationRepositoryTestCase,
    IntegrationTestCase,
    PluginTestCase,
    SlackActivityNotificationTest,
)
from .rules import RuleTestCase
from .snuba import (
    BaseIncidentsTest,
    MetricsAPIBaseTestCase,
    MetricsEnhancedPerformanceTestCase,
    OrganizationMetricMetaIntegrationTestCase,
    OutcomesSnubaTest,
    SessionMetricsTestCase,
    SnubaTestCase,
)


class ReleaseCommitPatchTest(APITestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[team])

        self.create_member(teams=[team], user=user, organization=self.org)
        self.login_as(user=user)

    @fixture
    def url(self):
        raise NotImplementedError

    def assert_commit(self, commit, repo_id, key, author_id, message):
        assert commit.organization_id == self.org.id
        assert commit.repository_id == repo_id
        assert commit.key == key
        assert commit.author_id == author_id
        assert commit.message == message

    def assert_file_change(self, file_change, type, filename, commit_id):
        assert file_change.type == type
        assert file_change.filename == filename
        assert file_change.commit_id == commit_id


class SetRefsTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()

        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[self.team])
        self.create_member(teams=[self.team], user=self.user, organization=self.org)
        self.login_as(user=self.user)

        self.group = self.create_group(project=self.project)
        self.repo = Repository.objects.create(organization_id=self.org.id, name="test/repo")

    def assert_fetch_commits(self, mock_fetch_commit, prev_release_id, release_id, refs):
        assert len(mock_fetch_commit.method_calls) == 1
        kwargs = mock_fetch_commit.method_calls[0][2]["kwargs"]
        assert kwargs == {
            "prev_release_id": prev_release_id,
            "refs": refs,
            "release_id": release_id,
            "user_id": self.user.id,
        }

    def assert_head_commit(self, head_commit, commit_key, release_id=None):
        assert self.org.id == head_commit.organization_id
        assert self.repo.id == head_commit.repository_id
        if release_id:
            assert release_id == head_commit.release_id
        else:
            assert self.release.id == head_commit.release_id
        self.assert_commit(head_commit.commit, commit_key)

    def assert_commit(self, commit, key):
        assert self.org.id == commit.organization_id
        assert self.repo.id == commit.repository_id
        assert commit.key == key


class OrganizationDashboardWidgetTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.anon_users_query = {
            "name": "Anonymous Users",
            "fields": ["count()"],
            "aggregates": ["count()"],
            "columns": [],
            "fieldAliases": ["Count Alias"],
            "conditions": "!has:user.email",
        }
        self.known_users_query = {
            "name": "Known Users",
            "fields": ["count_unique(user.email)"],
            "aggregates": ["count_unique(user.email)"],
            "columns": [],
            "fieldAliases": [],
            "conditions": "has:user.email",
        }
        self.geo_errors_query = {
            "name": "Errors by Geo",
            "fields": ["count()", "geo.country_code"],
            "aggregates": ["count()"],
            "columns": ["geo.country_code"],
            "fieldAliases": [],
            "conditions": "has:geo.country_code",
        }

    def do_request(self, method, url, data=None):
        func = getattr(self.client, method)
        return func(url, data=data)

    def assert_widget_queries(self, widget_id, data):
        result_queries = DashboardWidgetQuery.objects.filter(widget_id=widget_id).order_by("order")
        for ds, expected_ds in zip(result_queries, data):
            assert ds.name == expected_ds["name"]
            assert ds.fields == expected_ds["fields"]
            assert ds.conditions == expected_ds["conditions"]

    def assert_widget(self, widget, order, title, display_type, queries=None):
        assert widget.order == order
        assert widget.display_type == display_type
        assert widget.title == title

        if not queries:
            return

        self.assert_widget_queries(widget.id, queries)

    def assert_widget_data(self, data, title, display_type, queries=None):
        assert data["displayType"] == display_type
        assert data["title"] == title

        if not queries:
            return

        self.assert_widget_queries(data["id"], queries)

    def assert_serialized_widget_query(self, data, widget_data_source):
        if "id" in data:
            assert data["id"] == str(widget_data_source.id)
        if "name" in data:
            assert data["name"] == widget_data_source.name
        if "fields" in data:
            assert data["fields"] == widget_data_source.fields
        if "conditions" in data:
            assert data["conditions"] == widget_data_source.conditions
        if "orderby" in data:
            assert data["orderby"] == widget_data_source.orderby
        if "aggregates" in data:
            assert data["aggregates"] == widget_data_source.aggregates
        if "columns" in data:
            assert data["columns"] == widget_data_source.columns
        if "fieldAliases" in data:
            assert data["fieldAliases"] == widget_data_source.field_aliases

    def get_widgets(self, dashboard_id):
        return DashboardWidget.objects.filter(dashboard_id=dashboard_id).order_by("order")

    def assert_serialized_widget(self, data, expected_widget):
        if "id" in data:
            assert data["id"] == str(expected_widget.id)
        if "title" in data:
            assert data["title"] == expected_widget.title
        if "interval" in data:
            assert data["interval"] == expected_widget.interval
        if "limit" in data:
            assert data["limit"] == expected_widget.limit
        if "displayType" in data:
            assert data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
                expected_widget.display_type
            )
        if "layout" in data:
            assert data["layout"] == expected_widget.detail["layout"]

    def create_user_member_role(self):
        self.user = self.create_user(is_superuser=False)
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)


class TestMigrations(TestCase):
    """
    From https://www.caktusgroup.com/blog/2016/02/02/writing-unit-tests-django-migrations/
    """

    @property
    def app(self):
        return "sentry"

    migrate_from = None
    migrate_to = None

    def setUp(self):
        assert (
            self.migrate_from and self.migrate_to
        ), "TestCase '{}' must define migrate_from and migrate_to properties".format(
            type(self).__name__
        )
        self.migrate_from = [(self.app, self.migrate_from)]
        self.migrate_to = [(self.app, self.migrate_to)]
        executor = MigrationExecutor(connection)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        # Reverse to the original migration
        executor.migrate(self.migrate_from)

        self.setup_before_migration(old_apps)

        # Run the migration to test
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()  # reload.
        executor.migrate(self.migrate_to)

        self.apps = executor.loader.project_state(self.migrate_to).apps

    def setup_before_migration(self, apps):
        pass
