from unittest import TestCase, mock
from unittest.mock import Mock, patch

from sentry.api.endpoints.organization_projects_experiment import DISABLED_FEATURE_ERROR_STRING
from sentry.constants import RESERVED_PROJECT_SLUGS
from sentry.ingest import inbound_filters
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.signals import alert_rule_created
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class TeamProjectsListTest(APITestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "get"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.proj1 = self.create_project(teams=[self.team])
        self.proj2 = self.create_project(teams=[self.team])
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )
        project_ids = {item["id"] for item in response.data}

        assert len(response.data) == 2
        assert project_ids == {str(self.proj1.id), str(self.proj2.id)}

    def test_excludes_project(self):
        proj3 = self.create_project()
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )

        assert str(proj3.id) not in response.data


class TeamProjectsCreateTest(APITestCase, TestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.data = {"name": "foo", "slug": "bar", "platform": "python"}
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=201,
        )

        # fetch from db to check project's team
        project = Project.objects.get(id=response.data["id"])
        assert project.name == "foo"
        assert project.slug == "bar"
        assert project.platform == "python"
        assert project.teams.first() == self.team

    def test_invalid_numeric_slug(self):
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            slug="12345",
            status_code=400,
        )

        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="1234",
            status_code=201,
        )
        slug = response.data["slug"]
        assert slug.startswith("1234-")
        assert not slug.isdecimal()

    def test_invalid_platform(self):
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            platform="fake platform",
            status_code=400,
        )
        assert response.data["platform"][0] == "Invalid platform"

    def test_invalid_name(self):

        invalid_name = list(RESERVED_PROJECT_SLUGS)[0]
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name=invalid_name,
            platform="python",
            status_code=400,
        )
        assert response.data["name"][0] == f'The name "{invalid_name}" is reserved and not allowed.'

    def test_duplicate_slug(self):
        self.create_project(slug="bar")
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=409,
        )
        assert response.data["detail"] == "A project with this slug already exists."

    def test_default_rules(self):
        signal_handler = Mock()
        alert_rule_created.connect(signal_handler)

        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=True,
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        rule = Rule.objects.get(project=project)

        assert (
            rule.data["actions"][0]["fallthroughType"] == FallthroughChoiceType.ACTIVE_MEMBERS.value
        )

        # Ensure that creating the default alert rule does trigger the
        # alert_rule_created signal
        assert signal_handler.call_count == 1
        alert_rule_created.disconnect(signal_handler)

    def test_without_default_rules_disable_member_project_creation(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=False,
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        assert not Rule.objects.filter(project=project).exists()

    def test_disable_member_project_creation(self):
        test_org = self.create_organization(flags=256)
        test_team = self.create_team(organization=test_org)

        test_member = self.create_user(is_superuser=False)
        self.create_member(user=test_member, organization=test_org, role="admin", teams=[test_team])
        self.login_as(user=test_member)
        response = self.get_error_response(
            test_org.slug,
            test_team.slug,
            **self.data,
            status_code=403,
        )
        assert response.data["detail"] == DISABLED_FEATURE_ERROR_STRING

        test_manager = self.create_user(is_superuser=False)
        self.create_member(user=test_manager, organization=test_org, role="manager", teams=[])
        self.login_as(user=test_manager)
        self.get_success_response(
            test_org.slug,
            test_team.slug,
            **self.data,
            status_code=201,
        )

    def test_default_inbound_filters(self):
        filters = ["browser-extensions", "legacy-browsers", "web-crawlers", "filtered-transaction"]
        python_response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=201,
        )

        python_project = Project.objects.get(id=python_response.data["id"])

        python_filter_states = {
            filter_id: inbound_filters.get_filter_state(filter_id, python_project)
            for filter_id in filters
        }

        assert not python_filter_states["browser-extensions"]
        assert not python_filter_states["legacy-browsers"]
        assert not python_filter_states["web-crawlers"]
        assert python_filter_states["filtered-transaction"]

        project_data = {"name": "foo", "slug": "baz", "platform": "javascript-react"}
        javascript_response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **project_data,
            status_code=201,
        )

        javascript_project = Project.objects.get(id=javascript_response.data["id"])

        javascript_filter_states = {
            filter_id: inbound_filters.get_filter_state(filter_id, javascript_project)
            for filter_id in filters
        }

        assert javascript_filter_states["browser-extensions"]
        assert set(javascript_filter_states["legacy-browsers"]) == {
            "ie",
            "firefox",
            "chrome",
            "safari",
            "opera",
            "opera_mini",
            "android",
            "edge",
        }
        assert javascript_filter_states["web-crawlers"]
        assert javascript_filter_states["filtered-transaction"]

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    def test_similarity_project_option_valid(self):
        """
        Test that project option for similarity grouping is created when the project platform is
        Seer-eligible.
        """
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        assert project.name == "foo"
        assert project.slug == "bar"
        assert project.platform == "python"
        assert project.teams.first() == self.team

        assert (
            ProjectOption.objects.get_value(
                project=project, key="sentry:similarity_backfill_completed"
            )
            is not None
        )

    def test_similarity_project_option_invalid(self):
        """
        Test that project option for similarity grouping is not created when the project platform
        is not seer eligible.
        """
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="foo",
            slug="bar",
            platform="php",
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        assert project.name == "foo"
        assert project.slug == "bar"
        assert project.platform == "php"
        assert project.teams.first() == self.team

        assert (
            ProjectOption.objects.get_value(
                project=project, key="sentry:similarity_backfill_completed"
            )
            is None
        )

    def test_builtin_symbol_sources_electron(self):
        """
        Test that project option for builtin symbol sources contains ["electron"] when creating
        an Electron project, but uses defaults for other platforms.
        """
        # Test Electron project
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="electron-app",
            slug="electron-app",
            platform="electron",
            status_code=201,
        )

        electron_project = Project.objects.get(id=response.data["id"])
        assert electron_project.platform == "electron"
        symbol_sources = ProjectOption.objects.get_value(
            project=electron_project, key="sentry:builtin_symbol_sources"
        )
        assert symbol_sources == ["ios", "microsoft", "electron"]

    def test_builtin_symbol_sources_not_electron(self):
        # Test non-Electron project (e.g. Python)
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="python-app",
            slug="python-app",
            platform="python",
            status_code=201,
        )

        python_project = Project.objects.get(id=response.data["id"])
        assert python_project.platform == "python"
        # Should use default value, not ["electron"]
        symbol_sources = ProjectOption.objects.get_value(
            project=python_project, key="sentry:builtin_symbol_sources"
        )
        assert "electron" not in symbol_sources

    @patch("sentry.api.endpoints.team_projects.TeamProjectsEndpoint.create_audit_entry")
    def test_create_project_with_origin(self, create_audit_entry):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=False,
            status_code=201,
            origin="ui",
        )
        project = Project.objects.get(id=response.data["id"])

        assert create_audit_entry.call_count == 1

        # Verify audit log
        create_audit_entry.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=project.id,
            event=1154,
            data={
                **project.get_audit_log_data(),
                "origin": "ui",
            },
        )
