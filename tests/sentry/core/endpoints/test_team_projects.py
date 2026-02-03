from unittest import TestCase, mock
from unittest.mock import MagicMock, Mock, patch

from sentry.constants import RESERVED_PROJECT_SLUGS
from sentry.ingest import inbound_filters
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.signals import alert_rule_created, project_created
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE


class TeamProjectsListTest(APITestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.proj1 = self.create_project(teams=[self.team])
        self.proj2 = self.create_project(teams=[self.team])
        self.login_as(user=self.user)

    def test_simple(self) -> None:
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )
        project_ids = {item["id"] for item in response.data}

        assert len(response.data) == 2
        assert project_ids == {str(self.proj1.id), str(self.proj2.id)}

    def test_excludes_project(self) -> None:
        proj3 = self.create_project()
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )

        assert str(proj3.id) not in response.data


class TeamProjectsCreateTest(APITestCase, TestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.data = {"name": "foo", "slug": "bar", "platform": "python"}
        self.login_as(user=self.user)

    def test_simple(self) -> None:
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
        assert response.data["teams"] is not None
        assert response.data["teams"][0]["id"] == str(self.team.id)

    def test_invalid_numeric_slug(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            slug="12345",
            status_code=400,
        )

        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="1234",
            status_code=201,
        )
        slug = response.data["slug"]
        assert slug.startswith("1234-")
        assert not slug.isdecimal()

    def test_invalid_platform(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            platform="fake platform",
            status_code=400,
        )
        assert response.data["platform"][0] == "Invalid platform"

    def test_invalid_name(self) -> None:

        invalid_name = list(RESERVED_PROJECT_SLUGS)[0]
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name=invalid_name,
            platform="python",
            status_code=400,
        )
        assert response.data["name"][0] == f'The name "{invalid_name}" is reserved and not allowed.'

    def test_duplicate_slug(self) -> None:
        self.create_project(slug="bar")
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=409,
        )
        assert response.data["detail"] == "A project with this slug already exists."

    def test_default_rules(self) -> None:
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

    def test_without_default_rules_disable_member_project_creation(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=False,
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        assert not Rule.objects.filter(project=project).exists()

    def test_disable_member_project_creation(self) -> None:
        test_org = self.create_organization(flags=256)
        test_team = self.create_team(organization=test_org)

        # org member cannot create project when they are not a team admin of the team
        test_member = self.create_user(is_superuser=False)
        self.create_member(
            user=test_member,
            organization=test_org,
            role="member",
            team_roles=[(test_team, "contributor")],
        )
        self.login_as(user=test_member)
        self.get_error_response(
            test_org.slug,
            test_team.slug,
            **self.data,
            status_code=403,
        )

        # org member can create project when they are a team admin of the team
        test_team_admin = self.create_user(is_superuser=False)
        self.create_member(
            user=test_team_admin,
            organization=test_org,
            role="member",
            team_roles=[(test_team, "admin")],
        )
        self.login_as(user=test_team_admin)
        self.get_success_response(
            test_org.slug,
            test_team.slug,
            status_code=201,
            name="test",
            slug="test-1",
            platform="python",
        )

        # org admin can create project
        test_admin = self.create_user(is_superuser=False)
        self.create_member(user=test_admin, organization=test_org, role="admin", teams=[test_team])
        self.login_as(user=test_admin)
        self.get_success_response(
            test_org.slug,
            test_team.slug,
            status_code=201,
            name="test",
            slug="test-2",
            platform="python",
        )

        # org manager can create project
        test_manager = self.create_user(is_superuser=False)
        self.create_member(user=test_manager, organization=test_org, role="manager", teams=[])
        self.login_as(user=test_manager)
        self.get_success_response(
            test_org.slug,
            test_team.slug,
            status_code=201,
            name="test",
            slug="test-3",
            platform="python",
        )

    def test_default_inbound_filters(self) -> None:
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
    def test_similarity_project_option_valid(self) -> None:
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

    def test_similarity_project_option_invalid(self) -> None:
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

    def test_builtin_symbol_sources_electron(self) -> None:
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

    def test_builtin_symbol_sources_not_electron(self) -> None:
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

    def test_builtin_symbol_sources_unity(self) -> None:
        """
        Test that project option for builtin symbol sources contains relevant buckets
        when creating a Unity project, but uses defaults for other platforms.
        """
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="unity-app",
            slug="unity-app",
            platform="unity",
            status_code=201,
        )

        unity_project = Project.objects.get(id=response.data["id"])
        assert unity_project.platform == "unity"
        symbol_sources = ProjectOption.objects.get_value(
            project=unity_project, key="sentry:builtin_symbol_sources"
        )
        assert symbol_sources == [
            "ios",
            "microsoft",
            "android",
            "nuget",
            "unity",
            "nvidia",
            "ubuntu",
        ]

    def test_builtin_symbol_sources_unreal(self) -> None:
        """
        Test that project option for builtin symbol sources contains relevant buckets
        when creating a Unreal project, but uses defaults for other platforms.
        """
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="unreal-app",
            slug="unreal-app",
            platform="unreal",
            status_code=201,
        )

        unreal_project = Project.objects.get(id=response.data["id"])
        assert unreal_project.platform == "unreal"
        symbol_sources = ProjectOption.objects.get_value(
            project=unreal_project, key="sentry:builtin_symbol_sources"
        )
        assert symbol_sources == ["ios", "microsoft", "android", "nvidia", "ubuntu"]

    def test_builtin_symbol_sources_godot(self) -> None:
        """
        Test that project option for builtin symbol sources contains relevant buckets
        when creating a Godot project, but uses defaults for other platforms.
        """
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="godot-app",
            slug="godot-app",
            platform="godot",
            status_code=201,
        )

        godot_project = Project.objects.get(id=response.data["id"])
        assert godot_project.platform == "godot"
        symbol_sources = ProjectOption.objects.get_value(
            project=godot_project, key="sentry:builtin_symbol_sources"
        )
        assert symbol_sources == ["ios", "microsoft", "android", "nuget", "nvidia", "ubuntu"]

    @patch("sentry.core.endpoints.team_projects.TeamProjectsEndpoint.create_audit_entry")
    def test_create_project_with_origin(self, create_audit_entry: MagicMock) -> None:
        signal_handler = Mock()
        project_created.connect(signal_handler)

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

        # Verify origin is passed to project_created signal
        assert signal_handler.call_count == 1
        assert signal_handler.call_args[1]["origin"] == "ui"
        project_created.disconnect(signal_handler)

    def test_project_inherits_autofix_tuning_from_org_option_set(self) -> None:
        self.organization.update_option("sentry:default_autofix_automation_tuning", "medium")
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="Project Medium Tuning",
            slug="project-medium-tuning",
            platform="python",
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        autofix_tuning = ProjectOption.objects.get_value(
            project=project, key="sentry:autofix_automation_tuning"
        )
        assert autofix_tuning == "medium"

    def test_project_autofix_tuning_not_set_if_org_option_not_set_in_db(self) -> None:
        # Ensure the option is not set for this specific organization
        self.organization.delete_option("sentry:default_autofix_automation_tuning")
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="Project Tuning Default",
            slug="project-tuning-default",
            platform="python",
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        # Verify no option was explicitly written to the database
        assert not ProjectOption.objects.filter(
            project=project, key="sentry:autofix_automation_tuning"
        ).exists()

    def test_project_autofix_tuning_defaults_to_medium_with_triage_signals_flag(self) -> None:
        # Ensure no org-level default is set
        self.organization.delete_option("sentry:default_autofix_automation_tuning")
        with self.feature("organizations:triage-signals-v0-org"):
            response = self.get_success_response(
                self.organization.slug,
                self.team.slug,
                name="Project With Flag",
                slug="project-with-flag",
                platform="python",
                status_code=201,
            )
        project = Project.objects.get(id=response.data["id"])
        autofix_tuning = ProjectOption.objects.get_value(
            project=project, key="sentry:autofix_automation_tuning"
        )
        assert autofix_tuning == "medium"

    def test_project_autofix_tuning_respects_explicit_off_even_with_flag(self) -> None:
        # Org explicitly sets "off" - should be respected even with feature flag
        self.organization.update_option("sentry:default_autofix_automation_tuning", "off")
        with self.feature("organizations:triage-signals-v0-org"):
            response = self.get_success_response(
                self.organization.slug,
                self.team.slug,
                name="Project Explicit Off",
                slug="project-explicit-off",
                platform="python",
                status_code=201,
            )
        project = Project.objects.get(id=response.data["id"])
        autofix_tuning = ProjectOption.objects.get_value(
            project=project, key="sentry:autofix_automation_tuning"
        )
        assert autofix_tuning == "off"

    def test_project_autofix_tuning_flag_overrides_non_off_org_default(self) -> None:
        # Org sets "high" but feature flag overrides to "medium"
        self.organization.update_option("sentry:default_autofix_automation_tuning", "high")
        with self.feature("organizations:triage-signals-v0-org"):
            response = self.get_success_response(
                self.organization.slug,
                self.team.slug,
                name="Project Flag Override",
                slug="project-flag-override",
                platform="python",
                status_code=201,
            )
        project = Project.objects.get(id=response.data["id"])
        autofix_tuning = ProjectOption.objects.get_value(
            project=project, key="sentry:autofix_automation_tuning"
        )
        assert autofix_tuning == "medium"

    def test_console_platform_not_enabled(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="Nintendo Project",
            platform="nintendo-switch",
            status_code=400,
        )
        assert "Console platform 'nintendo-switch' is not enabled for this organization" in str(
            response.data["platform"]
        )

    def test_console_platform_enabled(self) -> None:
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="Nintendo Project",
            slug="nintendo-project",
            platform="nintendo-switch",
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        assert project.name == "Nintendo Project"
        assert project.platform == "nintendo-switch"

    def test_console_platform_xbox_not_enabled(self) -> None:
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="Xbox Project",
            platform="xbox",
            status_code=400,
        )
        assert "Console platform 'xbox' is not enabled for this organization" in str(
            response.data["platform"]
        )
