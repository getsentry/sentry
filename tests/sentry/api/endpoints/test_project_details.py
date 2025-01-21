from __future__ import annotations

from abc import ABC
from datetime import datetime, timedelta, timezone
from time import time
from typing import Any
from unittest import mock

import orjson
from django.db import router
from django.urls import reverse
from sentry_relay.processing import normalize_cardinality_limit_config

from sentry import audit_log
from sentry.constants import RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.dynamic_sampling import DEFAULT_BIASES, RuleType
from sentry.dynamic_sampling.rules.base import NEW_MODEL_THRESHOLD_IN_MINUTES
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.issues.highlights import get_highlight_preset_for_project
from sentry.models.apitoken import ApiToken
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.deletedproject import DeletedProject
from sentry.models.environment import EnvironmentProject
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectredirect import ProjectRedirect
from sentry.models.projectteam import ProjectTeam
from sentry.models.rule import Rule
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


def first_symbol_source_id(sources_json):
    sources = orjson.loads(sources_json)
    return sources[0]["id"]


class ProjectDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_superuser_simple(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_staff_simple(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_numeric_org_slug(self):
        # Regression test for https://github.com/getsentry/sentry/issues/2236
        project = self.create_project(name="Bar", slug="bar", teams=[self.team])

        # We want to make sure we don't hit the LegacyProjectRedirect view at all.
        url = f"/api/0/projects/{self.organization.slug}/{project.slug}/"
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == str(project.id)

    def test_with_stats(self):
        self.create_group(project=self.project)

        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, qs_params={"include": "stats"}
        )
        assert response.data["stats"]["unresolved"] == 1

    def test_has_alert_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="msteams")
            integration.add_organization(self.organization)

        self.create_group(project=self.project)

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            qs_params={"expand": "hasAlertIntegration"},
        )
        assert response.data["hasAlertIntegrationInstalled"]

    def test_no_alert_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="jira")
            integration.add_organization(self.organization)

        self.create_group(project=self.project)

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            qs_params={"expand": "hasAlertIntegration"},
        )
        assert not response.data["hasAlertIntegrationInstalled"]

    def test_filters_disabled_plugins(self):
        from sentry.plugins.base import plugins

        self.create_group(project=self.project)

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
        )
        assert response.data["plugins"] == []

        asana_plugin = plugins.get("asana")
        asana_plugin.enable(self.project)

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
        )
        assert len(response.data["plugins"]) == 1
        assert response.data["plugins"][0]["slug"] == asana_plugin.slug

    def test_project_renamed_302(self):
        # Rename the project
        self.get_success_response(
            self.project.organization.slug, self.project.slug, method="put", slug="foobar"
        )

        with outbox_runner():
            response = self.get_success_response(
                self.project.organization.slug, self.project.slug, status_code=302
            )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.get(
                    organization_id=self.project.organization_id,
                    event=audit_log.get_event_id("PROJECT_EDIT"),
                ).data.get("old_slug")
                == self.project.slug
            )
            assert (
                AuditLogEntry.objects.get(
                    organization_id=self.project.organization_id,
                    event=audit_log.get_event_id("PROJECT_EDIT"),
                ).data.get("new_slug")
                == "foobar"
            )
        assert response.data["slug"] == "foobar"
        assert (
            response.data["detail"]["extra"]["url"]
            == f"/api/0/projects/{self.project.organization.slug}/foobar/"
        )
        redirect_path = f"/api/0/projects/{self.project.organization.slug}/foobar/"
        # XXX: AttributeError: 'Response' object has no attribute 'url'
        # (this is with self.assertRedirects(response, ...))
        assert response["Location"] == redirect_path

    def test_non_org_rename_403(self):
        org = self.create_organization()
        team = self.create_team(organization=org, name="foo", slug="foo")
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=org, role="member", teams=[team])

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        ProjectRedirect.record(other_project, "old_slug")
        self.login_as(user=user)

        self.get_error_response(other_org.slug, "old_slug", status_code=403)

    def test_highlight_preset(self):
        assert self.project.get_option("sentry:highlight_context") is None
        assert self.project.get_option("sentry:highlight_tags") is None
        resp = self.get_success_response(self.project.organization.slug, self.project.slug)
        expected_preset = get_highlight_preset_for_project(self.project)
        assert resp.data["highlightPreset"] == expected_preset
        assert resp.data["highlightContext"] == expected_preset["context"]
        assert resp.data["highlightTags"] == expected_preset["tags"]

    def test_is_dynamically_sampled_pan_rate(self):
        # test with feature flags disabled
        with self.feature("organizations:dynamic-sampling"):
            with mock.patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ):
                resp = self.get_success_response(self.project.organization.slug, self.project.slug)
                assert resp.data["isDynamicallySampled"]

            with mock.patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ):
                resp = self.get_success_response(self.project.organization.slug, self.project.slug)
                assert not resp.data["isDynamicallySampled"]

            with mock.patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ):
                resp = self.get_success_response(self.project.organization.slug, self.project.slug)
                assert not resp.data["isDynamicallySampled"]

    def test_is_dynamically_sampled(self):
        # test with feature flags disabled
        with self.feature(
            {
                "organizations:dynamic-sampling": False,
                "organizations:dynamic-sampling-custom": False,
            }
        ):
            resp = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert not resp.data["isDynamicallySampled"]

        # test with sampling_mode = organization
        self.project.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )

        # test not sampled organization
        self.project.organization.update_option("sentry:target_sample_rate", 1.0)
        with self.feature("organizations:dynamic-sampling-custom"):
            resp = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert not resp.data["isDynamicallySampled"]

        # test dynamically sampled organization
        self.project.organization.update_option("sentry:target_sample_rate", 0.1)
        with self.feature("organizations:dynamic-sampling-custom"):
            resp = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert resp.data["isDynamicallySampled"]

        # test with sampling_mode = project
        self.project.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.PROJECT.value
        )

        # test with not sampled project
        self.project.update_option("sentry:target_sample_rate", 1.0)
        with self.feature("organizations:dynamic-sampling-custom"):
            resp = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert not resp.data["isDynamicallySampled"]

        # test with sampled project
        self.project.update_option("sentry:target_sample_rate", 0.1)
        with self.feature("organizations:dynamic-sampling-custom"):
            resp = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert resp.data["isDynamicallySampled"]


class ProjectUpdateTestTokenAuthenticated(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(platform="javascript")
        self.user = self.create_user("bar@example.com")
        self.url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        self.platforms = ["rust", "java"]

    def test_member_can_update_limited_project_details(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="member",
        )
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])

        response = self.client.put(
            self.url,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            data={"isBookmarked": True},
        )
        assert response.status_code == 200
        assert response.data["isBookmarked"] is True

    def test_admin_update_allowed_with_correct_token_scope(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="admin",
        )

        for i, scope in enumerate(["project:write", "project:admin"]):
            token = self.create_user_auth_token(user=self.user, scope_list=[scope])
            platform = self.platforms[i]

            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                data={"platform": platform},
            )
            assert response.status_code == 200
            assert response.data["platform"] == platform

    @with_feature("organizations:team-roles")
    def test_team_admin_update_allowed_with_correct_token_scope(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            role="member",
        )
        self.create_team_membership(user=self.user, team=self.team, role="admin")

        for i, scope in enumerate(["project:write", "project:admin"]):
            token = self.create_user_auth_token(user=self.user, scope_list=[scope])
            platform = self.platforms[i]

            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                data={"platform": platform},
            )
            assert response.status_code == 200
            assert response.data["platform"] == platform

    def test_manager_update_allowed_with_correct_token_scope(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="manager",
        )

        for i, scope in enumerate(["project:write", "project:admin"]):
            token = self.create_user_auth_token(user=self.user, scope_list=[scope])
            platform = self.platforms[i]

            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                data={"platform": platform},
            )
            assert response.status_code == 200
            assert response.data["platform"] == platform

    def test_owner_update_allowed_with_correct_token_scope(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="owner",
        )

        for i, scope in enumerate(["project:write", "project:admin"]):
            token = self.create_user_auth_token(user=self.user, scope_list=[scope])
            platform = self.platforms[i]

            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                data={"platform": platform},
            )
            assert response.status_code == 200
            assert response.data["platform"] == platform

    def test_member_update_denied_with_token(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="member",
        )
        # members are only allowed to update 'isBookmarked' fields
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])

        response = self.client.put(
            self.url,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            data={"platform": "rust"},
        )
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_admin_update_denied_with_token(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="admin",
        )
        # even though the user has the 'admin' role, they've issued a token with only a project:read scope
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])

        response = self.client.put(
            self.url,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            data={"platform": "rust"},
        )
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_empty_token_scopes_denied(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.team],
            role="member",
        )
        token = self.create_user_auth_token(user=self.user, scope_list=[""])

        response = self.client.put(
            self.url,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            data={"platform": "rust"},
        )
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."


class ProjectUpdateTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.org_slug = self.project.organization.slug
        self.proj_slug = self.project.slug
        self.login_as(user=self.user)

    def test_superuser_simple(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        self.get_success_response(self.org_slug, self.proj_slug, platform="native")
        project = Project.objects.get(id=self.project.id)
        assert project.platform == "native"

    def test_staff_simple(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        self.get_success_response(self.org_slug, self.proj_slug, platform="native")
        project = Project.objects.get(id=self.project.id)
        assert project.platform == "native"

    def test_blank_subject_prefix(self):
        project = Project.objects.get(id=self.project.id)
        options = {"mail:subject_prefix": "[Sentry]"}

        self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert project.get_option("mail:subject_prefix") == "[Sentry]"

        options["mail:subject_prefix"] = ""
        self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert project.get_option("mail:subject_prefix") == ""

    def test_simple_member_restriction(self):
        project = self.create_project()
        user = self.create_user("bar@example.com")
        self.create_member(
            user=user,
            organization=project.organization,
            teams=[project.teams.first()],
            role="member",
        )
        self.login_as(user)

        self.get_error_response(
            self.org_slug,
            self.proj_slug,
            slug="zzz",
            isBookmarked="true",
            status_code=403,
        )
        assert not ProjectBookmark.objects.filter(
            user_id=user.id, project_id=self.project.id
        ).exists()

    def test_member_changes_permission_denied(self):
        project = self.create_project()
        user = self.create_user("bar@example.com")
        self.create_member(
            user=user,
            organization=project.organization,
            teams=[project.teams.first()],
            role="member",
        )
        self.login_as(user=user)

        self.get_error_response(
            self.org_slug,
            self.proj_slug,
            slug="zzz",
            isBookmarked="true",
            status_code=403,
        )

        assert Project.objects.get(id=project.id).slug != "zzz"
        assert not ProjectBookmark.objects.filter(user_id=user.id, project_id=project.id).exists()

    @with_feature("organizations:team-roles")
    def test_member_with_team_role(self):
        user = self.create_user("bar@example.com")
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
        )

        team = self.create_team(organization=self.organization)
        project = self.create_project(teams=[team])
        self.create_team_membership(user=user, team=team, role="admin")

        self.login_as(user=user)

        self.get_success_response(
            self.organization.slug,
            project.slug,
            slug="zzz",
            isBookmarked="true",
        )

        assert Project.objects.get(id=project.id).slug == "zzz"
        assert ProjectBookmark.objects.filter(user_id=user.id, project_id=project.id).exists()

    def test_name(self):
        self.get_success_response(self.org_slug, self.proj_slug, name="hello world")
        project = Project.objects.get(id=self.project.id)
        assert project.name == "hello world"

    def test_slug(self):
        with outbox_runner():
            self.get_success_response(self.org_slug, self.proj_slug, slug="foobar")
        project = Project.objects.get(id=self.project.id)
        assert project.slug == "foobar"
        assert ProjectRedirect.objects.filter(project=self.project, redirect_slug=self.proj_slug)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()

    def test_invalid_slug(self):
        new_project = self.create_project()
        self.get_error_response(
            self.org_slug,
            self.proj_slug,
            slug=new_project.slug,
            status_code=400,
        )
        project = Project.objects.get(id=self.project.id)
        assert project.slug != new_project.slug

    def test_invalid_numeric_slug(self):
        response = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            slug="1234",
            status_code=400,
        )
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_reserved_slug(self):
        self.get_error_response(
            self.org_slug,
            self.proj_slug,
            slug=list(RESERVED_PROJECT_SLUGS)[0],
            status_code=400,
        )

    def test_platform(self):
        self.get_success_response(self.org_slug, self.proj_slug, platform="python")
        project = Project.objects.get(id=self.project.id)
        assert project.platform == "python"

    def test_platform_invalid(self):
        self.get_error_response(self.org_slug, self.proj_slug, platform="lol", status_code=400)

    def test_options(self):
        options: dict[str, Any] = {
            "sentry:resolve_age": 1,
            "sentry:scrub_data": False,
            "sentry:scrub_defaults": False,
            "sentry:sensitive_fields": ["foo", "bar"],
            "sentry:safe_fields": ["token"],
            "sentry:store_crash_reports": 0,
            "sentry:relay_pii_config": '{"applications": {"freeform": []}}',
            "sentry:csp_ignored_sources_defaults": False,
            "sentry:csp_ignored_sources": "foo\nbar",
            "sentry:grouping_config": "some-config",
            "filters:blacklisted_ips": "127.0.0.1\n198.51.100.0",
            "filters:releases": "1.*\n2.1.*",
            "filters:error_messages": "TypeError*\n*: integer division by modulo or zero",
            "mail:subject_prefix": "[Sentry]",
            "sentry:scrub_ip_address": False,
            "sentry:origins": "*",
            "sentry:scrape_javascript": False,
            "sentry:token": "*",
            "sentry:token_header": "*",
            "sentry:verify_ssl": False,
            "sentry:replay_hydration_error_issues": True,
            "sentry:toolbar_allowed_origins": "*.sentry.io\nexample.net  \nnugettrends.com",
            "sentry:replay_rage_click_issues": True,
            "sentry:feedback_user_report_notifications": True,
            "sentry:feedback_ai_spam_detection": True,
            "feedback:branding": False,
            "filters:react-hydration-errors": True,
            "filters:chunk-load-error": True,
        }
        with self.feature("projects:custom-inbound-filters"), outbox_runner():
            self.get_success_response(self.org_slug, self.proj_slug, options=options)

        project = Project.objects.get(id=self.project.id)
        assert project.get_option("sentry:origins", []) == options["sentry:origins"].split("\n")
        assert project.get_option("sentry:resolve_age", 0) == options["sentry:resolve_age"]
        assert project.get_option("sentry:scrub_data", True) == options["sentry:scrub_data"]
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:scrub_defaults", True) == options["sentry:scrub_defaults"]
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert (
            project.get_option("sentry:sensitive_fields", []) == options["sentry:sensitive_fields"]
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:safe_fields", []) == options["sentry:safe_fields"]
        assert (
            project.get_option("sentry:store_crash_reports")
            == options["sentry:store_crash_reports"]
        )

        assert (
            project.get_option("sentry:relay_pii_config", "") == options["sentry:relay_pii_config"]
        )
        assert project.get_option("sentry:grouping_config", "") == options["sentry:grouping_config"]
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert (
            project.get_option("sentry:csp_ignored_sources_defaults", True)
            == options["sentry:csp_ignored_sources_defaults"]
        )
        assert project.get_option("sentry:csp_ignored_sources", []) == options[
            "sentry:csp_ignored_sources"
        ].split("\n")
        assert project.get_option("sentry:blacklisted_ips") == ["127.0.0.1", "198.51.100.0"]
        assert project.get_option("sentry:releases") == ["1.*", "2.1.*"]
        assert project.get_option("sentry:error_messages") == [
            "TypeError*",
            "*: integer division by modulo or zero",
        ]
        assert project.get_option("mail:subject_prefix", "[Sentry]")
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:resolve_age", 1)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert (
            project.get_option("sentry:scrub_ip_address", True)
            == options["sentry:scrub_ip_address"]
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:origins", "*")
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert (
            project.get_option("sentry:scrape_javascript", False)
            == options["sentry:scrape_javascript"]
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:token", "*")
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:token_header", "*")
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("sentry:verify_ssl", False) == options["sentry:verify_ssl"]
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("feedback:branding") == "0"
        assert project.get_option("sentry:replay_hydration_error_issues") is True
        assert project.get_option("sentry:toolbar_allowed_origins") == [
            "*.sentry.io",
            "example.net",
            "nugettrends.com",
        ]
        assert project.get_option("sentry:replay_rage_click_issues") is True
        assert project.get_option("sentry:feedback_user_report_notifications") is True
        assert project.get_option("sentry:feedback_ai_spam_detection") is True

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).exists()
        assert project.get_option("filters:react-hydration-errors", "1")
        assert project.get_option("filters:chunk-load-error", "1")

    def test_custom_metrics_cardinality_limit(self):
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit=1000,
        )

        config = self.project.get_option("relay.cardinality-limiter.limits")

        assert config == [
            {
                "limit": {
                    "id": "project-override-custom",
                    "window": {"windowSeconds": 3600, "granularitySeconds": 600},
                    "limit": 1000,
                    "namespace": "custom",
                    "scope": "name",
                }
            }
        ]

        limit = config[0]["limit"]
        normalized_limit = normalize_cardinality_limit_config(limit)
        assert normalized_limit == limit

        assert resp.data["relayCustomMetricCardinalityLimit"] == 1000

    def test_custom_metrics_cardinality_limit_invalid_text(self):
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit="text",
        )
        assert self.project.get_option("replay.cardinality-limiter.limts", []) == []
        assert resp.data["relayCustomMetricCardinalityLimit"] == ["A valid integer is required."]

    def test_custom_metrics_cardinality_limit_invalid_negative_number(self):
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit=-1000,
        )
        assert self.project.get_option("replay.cardinality-limiter.limts", []) == []
        assert resp.data["relayCustomMetricCardinalityLimit"] == [
            "Cardinality limit must be a non-negative integer."
        ]

    def test_custom_metrics_cardinality_limit_invalid_too_high(self):
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit=4_294_967_296,
        )
        assert self.project.get_option("replay.cardinality-limiter.limts", []) == []
        assert resp.data["relayCustomMetricCardinalityLimit"] == [
            "Cardinality limit must be smaller or equal to 4,294,967,295."
        ]

    def test_custom_metrics_cardinality_limit_accepts_none(self):
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit=None,
        )
        assert self.project.get_option("replay.cardinality-limiter.limts", []) == []
        assert resp.data["relayCustomMetricCardinalityLimit"] is None

    def test_custom_metrics_cardinality_limit_gets_deleted_when_receiving_none(self):
        self.project.update_option(
            "relay.cardinality-limiter.limits",
            [
                {
                    "limit": {
                        "id": "project-override-custom",
                        "window": {"windowSeconds": 3600, "granularitySeconds": 600},
                        "limit": 1000,
                        "namespace": "custom",
                        "scope": "name",
                    }
                }
            ],
        )
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            relayCustomMetricCardinalityLimit=None,
        )
        assert self.project.get_option("replay.cardinality-limiter.limits", []) == []
        assert resp.data["relayCustomMetricCardinalityLimit"] is None

    def test_bookmarks(self):
        self.get_success_response(self.org_slug, self.proj_slug, isBookmarked="false")
        assert not ProjectBookmark.objects.filter(
            project_id=self.project.id, user_id=self.user.id
        ).exists()

    def test_security_token(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, securityToken="fizzbuzz")
        assert self.project.get_security_token() == "fizzbuzz"
        assert resp.data["securityToken"] == "fizzbuzz"

        # can delete
        resp = self.get_success_response(self.org_slug, self.proj_slug, securityToken="")
        assert self.project.get_security_token() == ""
        assert resp.data["securityToken"] == ""

    def test_security_token_header(self):
        value = "X-Hello-World"
        resp = self.get_success_response(self.org_slug, self.proj_slug, securityTokenHeader=value)
        assert self.project.get_option("sentry:token_header") == "X-Hello-World"
        assert resp.data["securityTokenHeader"] == "X-Hello-World"

        # can delete
        resp = self.get_success_response(self.org_slug, self.proj_slug, securityTokenHeader="")
        assert self.project.get_option("sentry:token_header") == ""
        assert resp.data["securityTokenHeader"] == ""

    def test_verify_ssl(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, verifySSL=False)
        assert self.project.get_option("sentry:verify_ssl") is False
        assert resp.data["verifySSL"] is False

    def test_scrub_ip_address(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, scrubIPAddresses=True)
        assert self.project.get_option("sentry:scrub_ip_address") is True
        assert resp.data["scrubIPAddresses"] is True

        resp = self.get_success_response(self.org_slug, self.proj_slug, scrubIPAddresses=False)
        assert self.project.get_option("sentry:scrub_ip_address") is False
        assert resp.data["scrubIPAddresses"] is False

    def test_scrape_javascript(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, scrapeJavaScript=False)
        assert self.project.get_option("sentry:scrape_javascript") is False
        assert resp.data["scrapeJavaScript"] is False

    def test_default_environment(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, defaultEnvironment="dev")
        assert self.project.get_option("sentry:default_environment") == "dev"
        assert resp.data["defaultEnvironment"] == "dev"

        resp = self.get_success_response(self.org_slug, self.proj_slug, defaultEnvironment="")
        assert self.project.get_option("sentry:default_environment") == ""
        assert resp.data["defaultEnvironment"] == ""

    def test_resolve_age(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, resolveAge=5)
        assert self.project.get_option("sentry:resolve_age") == 5
        assert resp.data["resolveAge"] == 5

        # can set to 0 or delete
        resp = self.get_success_response(self.org_slug, self.proj_slug, resolveAge="")
        assert self.project.get_option("sentry:resolve_age") == 0
        assert resp.data["resolveAge"] == 0

    def test_allowed_domains(self):
        value = ["foobar.com", "https://example.com"]
        resp = self.get_success_response(self.org_slug, self.proj_slug, allowedDomains=value)
        assert self.project.get_option("sentry:origins") == ["foobar.com", "https://example.com"]
        assert resp.data["allowedDomains"] == ["foobar.com", "https://example.com"]

        # cannot be empty
        resp = self.get_error_response(
            self.org_slug, self.proj_slug, allowedDomains="", status_code=400
        )
        assert self.project.get_option("sentry:origins") == ["foobar.com", "https://example.com"]
        assert resp.data["allowedDomains"] == [
            "Empty value will block all requests, use * to accept from all domains"
        ]

        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            allowedDomains=["*", ""],
        )
        assert self.project.get_option("sentry:origins") == ["*"]
        assert resp.data["allowedDomains"] == ["*"]

    def test_safe_fields(self):
        value = ["foobar", "extra.fields.**"]
        resp = self.get_success_response(self.org_slug, self.proj_slug, safeFields=value)
        assert self.project.get_option("sentry:safe_fields") == [
            "foobar",
            "extra.fields.**",
        ]
        assert resp.data["safeFields"] == ["foobar", "extra.fields.**"]

        value = ["er ror", "double.**.wildcard.**"]
        resp = self.get_error_response(self.org_slug, self.proj_slug, safeFields=value)
        assert resp.data["safeFields"] == [
            'Invalid syntax near "er ror" (line 1),\nDeep wildcard used more than once (line 2)',
        ]

    def test_highlight_tags(self):
        # Unrelated change returns presets
        resp = self.get_success_response(self.org_slug, self.proj_slug)
        assert self.project.get_option("sentry:highlight_tags") is None
        preset = get_highlight_preset_for_project(self.project)
        assert resp.data["highlightTags"] == preset["tags"]
        assert resp.data["highlightPreset"] == preset

        # Set to custom
        highlight_tags = ["bears", "beets", "battlestar_galactica"]
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            highlightTags=highlight_tags,
        )
        assert self.project.get_option("sentry:highlight_tags") == highlight_tags
        assert resp.data["highlightTags"] == highlight_tags

        # Set to empty
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            highlightTags=[],
        )
        assert self.project.get_option("sentry:highlight_tags") == []
        assert resp.data["highlightTags"] == []
        assert resp.data["highlightPreset"] == preset

    def test_highlight_context(self):
        # Unrelated change returns presets
        resp = self.get_success_response(self.org_slug, self.proj_slug)
        preset = get_highlight_preset_for_project(self.project)
        assert self.project.get_option("sentry:highlight_context") is None
        assert resp.data["highlightContext"] == preset["context"]
        assert resp.data["highlightPreset"] == preset

        # Set to custom
        highlight_context_type = "bird-words"
        highlight_context = {highlight_context_type: ["red", "robin", "blue", "jay", "red", "blue"]}
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            highlightContext=highlight_context,
        )
        option_result = self.project.get_option("sentry:highlight_context")
        resp_result = resp.data["highlightContext"]
        for highlight_context_key in highlight_context[highlight_context_type]:
            assert highlight_context_key in option_result[highlight_context_type]
            assert highlight_context_key in resp_result[highlight_context_type]

        # Filters duplicates
        assert (
            len(option_result[highlight_context_type])
            == len(resp_result[highlight_context_type])
            == 4
        )

        # Set to empty
        resp = self.get_success_response(
            self.org_slug,
            self.proj_slug,
            highlightContext={},
        )
        assert self.project.get_option("sentry:highlight_context") == {}
        assert resp.data["highlightContext"] == {}
        assert resp.data["highlightPreset"] == preset

        # Checking validation
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            highlightContext=["bird-words", ["red", "blue"]],
        )
        assert "Expected a dictionary" in resp.data["highlightContext"][0]
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            highlightContext={"": ["empty", "context", "type"]},
        )
        assert "Key '' is invalid" in resp.data["highlightContext"][0]
        resp = self.get_error_response(
            self.org_slug,
            self.proj_slug,
            highlightContext={"bird-words": ["invalid", 123, "integer"]},
        )
        assert "must be a list of strings" in resp.data["highlightContext"][0]

    def test_store_crash_reports(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, storeCrashReports=10)
        assert self.project.get_option("sentry:store_crash_reports") == 10
        assert resp.data["storeCrashReports"] == 10

    def test_store_crash_reports_exceeded(self):
        # NB: Align with test_organization_details.py
        data = {"storeCrashReports": 101}

        resp = self.get_error_response(self.org_slug, self.proj_slug, status_code=400, **data)
        assert self.project.get_option("sentry:store_crash_reports") is None
        assert b"storeCrashReports" in resp.content

    def test_store_crash_reports_inherit_organization_settings(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, storeCrashReports=None)
        assert self.project.get_option("sentry:store_crash_reports") is None
        assert resp.data["storeCrashReports"] is None

    def test_react_hydration_errors(self):
        options = {"filters:react-hydration-errors": False}
        resp = self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert self.project.get_option("filters:react-hydration-errors") == "0"
        assert resp.data["options"]["filters:react-hydration-errors"] is False

        options = {"filters:react-hydration-errors": True}
        resp = self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert self.project.get_option("filters:react-hydration-errors") == "1"
        assert resp.data["options"]["filters:react-hydration-errors"] is True

    def test_chunk_load_error(self):
        options = {"filters:chunk-load-error": False}
        resp = self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert self.project.get_option("filters:chunk-load-error") == "0"
        assert resp.data["options"]["filters:chunk-load-error"] is False

        options = {"filters:chunk-load-error": True}
        resp = self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert self.project.get_option("filters:chunk-load-error") == "1"
        assert resp.data["options"]["filters:chunk-load-error"] is True

    def test_relay_pii_config(self):
        value = '{"applications": {"freeform": []}}'
        resp = self.get_success_response(self.org_slug, self.proj_slug, relayPiiConfig=value)
        assert self.project.get_option("sentry:relay_pii_config") == value
        assert resp.data["relayPiiConfig"] == value

    def test_sensitive_fields(self):
        value = ["foobar.com", "https://example.com"]
        resp = self.get_success_response(self.org_slug, self.proj_slug, sensitiveFields=value)
        assert self.project.get_option("sentry:sensitive_fields") == [
            "foobar.com",
            "https://example.com",
        ]
        assert resp.data["sensitiveFields"] == ["foobar.com", "https://example.com"]

    def test_sensitive_fields_too_long(self):
        value = 1000 * ["0123456789"] + ["1"]
        resp = self.get_response(self.org_slug, self.proj_slug, sensitiveFields=value)
        assert resp.status_code == 400

    def test_data_scrubber(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, dataScrubber=False)
        assert self.project.get_option("sentry:scrub_data") is False
        assert resp.data["dataScrubber"] is False

    def test_data_scrubber_defaults(self):
        resp = self.get_success_response(self.org_slug, self.proj_slug, dataScrubberDefaults=False)
        assert self.project.get_option("sentry:scrub_defaults") is False
        assert resp.data["dataScrubberDefaults"] is False

    def test_digests_delay(self):
        self.get_success_response(self.org_slug, self.proj_slug, digestsMinDelay=1000)
        assert self.project.get_option("digests:mail:minimum_delay") == 1000

        self.get_success_response(self.org_slug, self.proj_slug, digestsMaxDelay=1200)
        assert self.project.get_option("digests:mail:maximum_delay") == 1200

        self.get_success_response(
            self.org_slug, self.proj_slug, digestsMinDelay=300, digestsMaxDelay=600
        )
        assert self.project.get_option("digests:mail:minimum_delay") == 300
        assert self.project.get_option("digests:mail:maximum_delay") == 600

    def test_digests_min_without_max(self):
        self.get_success_response(self.org_slug, self.proj_slug, digestsMinDelay=1200)
        assert self.project.get_option("digests:mail:minimum_delay") == 1200

    def test_digests_max_without_min(self):
        self.get_success_response(self.org_slug, self.proj_slug, digestsMaxDelay=1200)
        assert self.project.get_option("digests:mail:maximum_delay") == 1200

    def test_invalid_digests_min_delay(self):
        min_delay = 120

        self.project.update_option("digests:mail:minimum_delay", min_delay)

        self.get_error_response(self.org_slug, self.proj_slug, digestsMinDelay=59, status_code=400)
        self.get_error_response(
            self.org_slug, self.proj_slug, digestsMinDelay=3601, status_code=400
        )

        assert self.project.get_option("digests:mail:minimum_delay") == min_delay

    def test_invalid_digests_max_delay(self):
        min_delay = 120
        max_delay = 360

        self.project.update_option("digests:mail:minimum_delay", min_delay)
        self.project.update_option("digests:mail:maximum_delay", max_delay)

        self.get_error_response(self.org_slug, self.proj_slug, digestsMaxDelay=59, status_code=400)
        self.get_error_response(
            self.org_slug, self.proj_slug, digestsMaxDelay=3601, status_code=400
        )

        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

        # test sending only max
        self.get_error_response(self.org_slug, self.proj_slug, digestsMaxDelay=100, status_code=400)
        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

        # test sending min + invalid max
        self.get_error_response(
            self.org_slug, self.proj_slug, digestsMinDelay=120, digestsMaxDelay=100, status_code=400
        )
        assert self.project.get_option("digests:mail:minimum_delay") == min_delay
        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

    def test_cap_secondary_grouping_expiry(self):
        now = time()

        response = self.get_response(self.org_slug, self.proj_slug, secondaryGroupingExpiry=0)
        assert response.status_code == 400

        expiry = int(now + 3600 * 24 * 1)
        response = self.get_success_response(
            self.org_slug, self.proj_slug, secondaryGroupingExpiry=expiry
        )
        assert response.data["secondaryGroupingExpiry"] == expiry

        expiry = int(now + 3600 * 24 * 89)
        response = self.get_success_response(
            self.org_slug, self.proj_slug, secondaryGroupingExpiry=expiry
        )
        assert response.data["secondaryGroupingExpiry"] == expiry

        # Larger timestamps are capped to 91 days:
        expiry = int(now + 3600 * 24 * 365)
        response = self.get_success_response(
            self.org_slug, self.proj_slug, secondaryGroupingExpiry=expiry
        )
        expiry = response.data["secondaryGroupingExpiry"]
        assert (now + 3600 * 24 * 90) < expiry < (now + 3600 * 24 * 92)

    @mock.patch("sentry.api.base.create_audit_entry")
    def test_redacted_symbol_source_secrets(self, create_audit_entry):
        with Feature(
            {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}
        ):
            config = {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "filetypes": ["pe"],
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            }
            self.get_success_response(
                self.org_slug, self.proj_slug, symbolSources=orjson.dumps([config]).decode()
            )
            config["id"] = first_symbol_source_id(self.project.get_option("sentry:symbol_sources"))

            assert (
                self.project.get_option("sentry:symbol_sources") == orjson.dumps([config]).decode()
            )

            # redact password
            redacted_source = config.copy()
            redacted_source["password"] = {"hidden-secret": True}

            # check that audit entry was created with redacted password
            assert create_audit_entry.called

            ((_, kwargs),) = create_audit_entry.call_args_list
            assert kwargs["data"] == {
                "sentry:symbol_sources": [redacted_source],
                "id": self.project.id,
                "slug": self.project.slug,
                "name": self.project.name,
                "status": self.project.status,
                "public": self.project.public,
            }

            self.get_success_response(
                self.org_slug,
                self.proj_slug,
                symbolSources=orjson.dumps([redacted_source]).decode(),
            )
            # on save the magic object should be replaced with the previously set password
            assert (
                self.project.get_option("sentry:symbol_sources") == orjson.dumps([config]).decode()
            )

    @mock.patch("sentry.api.base.create_audit_entry")
    def test_redacted_symbol_source_secrets_unknown_secret(self, create_audit_entry):
        with Feature(
            {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}
        ):
            config = {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "filetypes": ["pe"],
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            }
            self.get_success_response(
                self.org_slug, self.proj_slug, symbolSources=orjson.dumps([config]).decode()
            )
            config["id"] = first_symbol_source_id(self.project.get_option("sentry:symbol_sources"))

            assert (
                self.project.get_option("sentry:symbol_sources") == orjson.dumps([config]).decode()
            )

            # prepare new call, this secret is not known
            new_source = config.copy()
            new_source["password"] = {"hidden-secret": True}
            new_source["id"] = "oops"
            response = self.get_response(
                self.org_slug, self.proj_slug, symbolSources=orjson.dumps([new_source]).decode()
            )
            assert response.status_code == 400
            assert orjson.loads(response.content) == {
                "symbolSources": ["Hidden symbol source secret is missing a value"]
            }

    def symbol_sources(self):
        project = Project.objects.get(id=self.project.id)
        source1 = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "filetypes": ["pe"],
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        source2 = {
            "id": "bloop",
            "name": "bloop source",
            "layout": {
                "type": "native",
            },
            "filetypes": ["pe"],
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project.update_option("sentry:symbol_sources", orjson.dumps([source1, source2]).decode())
        return [source1, source2]

    def test_symbol_sources_no_modification(self):
        source1, source2 = self.symbol_sources()
        project = Project.objects.get(id=self.project.id)
        with Feature({"organizations:custom-symbol-sources": False}):
            resp = self.get_response(
                self.org_slug,
                self.proj_slug,
                symbolSources=orjson.dumps([source1, source2]).decode(),
            )

            assert resp.status_code == 200
            assert project.get_option(
                "sentry:symbol_sources", orjson.dumps([source1, source2]).decode()
            )

    def test_symbol_sources_deletion(self):
        source1, source2 = self.symbol_sources()
        project = Project.objects.get(id=self.project.id)
        with Feature({"organizations:custom-symbol-sources": False}):
            resp = self.get_response(
                self.org_slug, self.proj_slug, symbolSources=orjson.dumps([source1]).decode()
            )

            assert resp.status_code == 200
            assert project.get_option("sentry:symbol_sources", orjson.dumps([source1]).decode())

    @with_feature("organizations:uptime-settings")
    def test_uptime_settings(self):
        # test when the value is set to False
        resp = self.get_success_response(self.org_slug, self.proj_slug, uptimeAutodetection=False)
        assert self.project.get_option("sentry:uptime_autodetection") is False
        assert resp.data["uptimeAutodetection"] is False
        # test when the value is set to True
        resp = self.get_success_response(self.org_slug, self.proj_slug, uptimeAutodetection=True)
        assert self.project.get_option("sentry:uptime_autodetection") is True
        assert resp.data["uptimeAutodetection"] is True

    @with_feature({"organizations:dynamic-sampling-custom": False})
    def test_target_sample_rate_without_feature(self):
        self.project.update_option("sentry:target_sample_rate", 1.0)
        self.get_error_response(
            self.org_slug, self.proj_slug, targetSampleRate=0.1, status_code=400
        )
        assert self.project.get_option("sentry:target_sample_rate") == 1.0

    @with_feature({"organizations:dynamic-sampling-custom": True})
    def test_target_sample_rate_automatic_mode(self):
        self.project.update_option("sentry:target_sample_rate", 1.0)
        # automatic mode is called "organization" in code
        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )
        self.get_error_response(
            self.org_slug, self.proj_slug, targetSampleRate=0.1, status_code=400
        )
        assert self.project.get_option("sentry:target_sample_rate") == 1.0

    @with_feature({"organizations:dynamic-sampling-custom": True})
    def test_target_sample_rate_invalid(self):
        self.project.update_option("sentry:target_sample_rate", 1.0)
        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)
        self.get_error_response(
            self.org_slug, self.proj_slug, targetSampleRate=2.0, status_code=400
        )
        assert self.project.get_option("sentry:target_sample_rate") == 1.0

    @with_feature({"organizations:dynamic-sampling-custom": True})
    def test_target_sample_rate(self):
        self.project.update_option("sentry:target_sample_rate", 1.0)
        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)
        self.get_success_response(self.org_slug, self.proj_slug, targetSampleRate=0.1)
        assert self.project.get_option("sentry:target_sample_rate") == 0.1


class CopyProjectSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.options_dict = {
            "sentry:resolve_age": 1,
            "sentry:scrub_data": False,
            "sentry:scrub_defaults": False,
        }
        self.other_project = self.create_project()
        for key, value in self.options_dict.items():
            self.other_project.update_option(key=key, value=value)

        self.teams = [self.create_team(), self.create_team(), self.create_team()]

        for team in self.teams:
            ProjectTeam.objects.create(team=team, project=self.other_project)

        self.environments = [
            self.create_environment(project=self.other_project),
            self.create_environment(project=self.other_project),
        ]

        self.ownership = ProjectOwnership.objects.create(
            project=self.other_project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )

        Rule.objects.create(project=self.other_project, label="rule1")
        Rule.objects.create(project=self.other_project, label="rule2")
        Rule.objects.create(project=self.other_project, label="rule3")
        # there is a default rule added to project
        self.rules = Rule.objects.filter(project_id=self.other_project.id).order_by("label")

    def assert_other_project_settings_not_changed(self):
        # other_project should not have changed. This should check that.
        self.assert_settings_copied(self.other_project)

    def assert_settings_copied(self, project):
        for key, value in self.options_dict.items():
            assert project.get_option(key) == value

        project_teams = ProjectTeam.objects.filter(project_id=project.id, team__in=self.teams)
        assert len(project_teams) == len(self.teams)

        project_env = EnvironmentProject.objects.filter(
            project_id=project.id, environment__in=self.environments
        )
        assert len(project_env) == len(self.environments)

        ownership = ProjectOwnership.objects.get(project_id=project.id)
        assert ownership.raw == self.ownership.raw
        assert ownership.schema == self.ownership.schema

        rules = Rule.objects.filter(project_id=project.id).order_by("label")
        for rule, other_rule in zip(rules, self.rules):
            assert rule.label == other_rule.label

    def assert_settings_not_copied(self, project, teams=()):
        for key in self.options_dict.keys():
            assert project.get_option(key) is None

        project_teams = ProjectTeam.objects.filter(project_id=project.id, team__in=teams)
        assert len(project_teams) == len(teams)

        project_envs = EnvironmentProject.objects.filter(project_id=project.id)
        assert len(project_envs) == 0

        assert not ProjectOwnership.objects.filter(project_id=project.id).exists()

        # default rule
        rules = Rule.objects.filter(project_id=project.id)
        assert len(rules) == 1
        assert rules[0].label == "Send a notification for high priority issues"

    def test_simple(self):
        project = self.create_project()
        self.get_success_response(
            project.organization.slug, project.slug, copy_from_project=self.other_project.id
        )
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()

    def test_additional_params_in_payload(self):
        # Right now these are overwritten with the copied project's settings
        project = self.create_project()
        data = {
            "copy_from_project": self.other_project.id,
            "sentry:resolve_age": 2,
            "sentry:scrub_data": True,
            "sentry:scrub_defaults": True,
        }
        self.get_success_response(project.organization.slug, project.slug, **data)
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()

    def test_project_from_another_org(self):
        project = self.create_project(fire_project_created=True)
        other_project = self.create_project(
            organization=self.create_organization(), fire_project_created=True
        )
        resp = self.get_error_response(
            project.organization.slug,
            project.slug,
            copy_from_project=other_project.id,
            status_code=400,
        )
        assert resp.data == {"copy_from_project": ["Project to copy settings from not found."]}
        self.assert_settings_not_copied(project)
        self.assert_settings_not_copied(other_project)

    def test_project_does_not_exist(self):
        project = self.create_project(fire_project_created=True)
        resp = self.get_error_response(
            project.organization.slug, project.slug, copy_from_project=1234567890, status_code=400
        )
        assert resp.data == {"copy_from_project": ["Project to copy settings from not found."]}
        self.assert_settings_not_copied(project)

    def test_user_does_not_have_access_to_copy_from_project(self):
        user = self.create_user()
        self.login_as(user=user)
        team = self.create_team(members=[user])
        project = self.create_project(teams=[team], fire_project_created=True)

        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(
                user_id=user.id, organization=self.organization
            ).update(role="admin")

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        resp = self.get_error_response(
            project.organization.slug,
            project.slug,
            copy_from_project=self.other_project.id,
            status_code=400,
        )
        assert resp.data == {
            "copy_from_project": [
                "Project settings cannot be copied from a project you do not have access to."
            ]
        }
        self.assert_other_project_settings_not_changed()
        self.assert_settings_not_copied(project, teams=[team])

    def test_project_coping_from_has_team_user_lacks_write_access(self):
        user = self.create_user()
        self.login_as(user=user)
        team = self.create_team(members=[user])
        project = self.create_project(teams=[team], fire_project_created=True)

        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(
                user_id=user.id, organization=self.organization
            ).update(role="admin")

        self.other_project.add_team(team)

        # adding team user lacks write access to
        self.other_project.add_team(self.create_team())

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        resp = self.get_error_response(
            project.organization.slug,
            project.slug,
            copy_from_project=self.other_project.id,
            status_code=400,
        )

        assert resp.data == {
            "copy_from_project": [
                "Project settings cannot be copied from a project with a team you do not have write access to."
            ]
        }
        self.assert_other_project_settings_not_changed()
        self.assert_settings_not_copied(project, teams=[team])

    @mock.patch("sentry.models.project.Project.copy_settings_from")
    def test_copy_project_settings_fails(self, mock_copy_settings_from):
        mock_copy_settings_from.return_value = False
        project = self.create_project(fire_project_created=True)
        resp = self.get_error_response(
            project.organization.slug,
            project.slug,
            copy_from_project=self.other_project.id,
            status_code=409,
        )
        assert resp.data["detail"] == "Copy project settings failed."
        self.assert_settings_not_copied(project)
        self.assert_other_project_settings_not_changed()


class ProjectDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @mock.patch("sentry.db.mixin.uuid4")
    def _delete_project_and_assert_deleted(self, mock_uuid4_mixin):
        mock_uuid4_mixin.return_value = self.get_mock_uuid()

        with self.settings(SENTRY_PROJECT=0):
            self.get_success_response(
                self.project.organization.slug, self.project.slug, status_code=204
            )

        assert RegionScheduledDeletion.objects.filter(
            model_name="Project", object_id=self.project.id
        ).exists()

        project = Project.objects.get(id=self.project.id)
        assert project.status == ObjectStatus.PENDING_DELETION
        assert project.slug == "abc123"
        assert OrganizationOption.objects.filter(
            organization_id=project.organization_id,
            key=project.build_pending_deletion_key(),
        ).exists()
        deleted_project = DeletedProject.objects.get(slug=self.project.slug)
        self.assert_valid_deleted_log(deleted_project, self.project)

    def test_simple(self):
        self._delete_project_and_assert_deleted()

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        self._delete_project_and_assert_deleted()

    def test_staff(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        self._delete_project_and_assert_deleted()

    def test_internal_project(self):
        with self.settings(SENTRY_PROJECT=self.project.id):
            self.get_error_response(
                self.project.organization.slug, self.project.slug, status_code=403
            )

        assert not RegionScheduledDeletion.objects.filter(
            model_name="Project", object_id=self.project.id
        ).exists()

    @mock.patch(
        "sentry.tasks.delete_seer_grouping_records.call_seer_delete_project_grouping_records.apply_async"
    )
    def test_delete_project_and_delete_grouping_records(
        self, mock_call_seer_delete_project_grouping_records
    ):
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))
        self._delete_project_and_assert_deleted()
        mock_call_seer_delete_project_grouping_records.assert_called_with(args=[self.project.id])


class TestProjectDetailsDynamicSamplingBase(APITestCase, ABC):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        self.org_slug = self.project.organization.slug
        self.proj_slug = self.project.slug
        self.login_as(user=self.user)
        self.new_ds_flag = "organizations:dynamic-sampling"
        self._apply_old_date_to_project_and_org()

    def _apply_old_date_to_project_and_org(self):
        # We have to create the project and organization in the past, since we boost new orgs and projects to 100%
        # automatically.
        old_date = datetime.now(tz=timezone.utc) - timedelta(
            minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1
        )
        # We have to actually update the underneath db models because they are re-fetched, otherwise just the in-memory
        # copy is mutated.
        self.project.organization.update(date_added=old_date)
        self.project.update(date_added=old_date)


class TestProjectDetailsDynamicSamplingBiases(TestProjectDetailsDynamicSamplingBase):
    endpoint = "sentry-api-0-project-details"

    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.authorization = f"Bearer {token.token}"

    def test_get_dynamic_sampling_default_biases(self):
        """
        Tests the case when organization on AM2 plan, but haven't manipulated the bias toggles
        yet, so they get the default biases.
        """
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert response.data["dynamicSamplingBiases"] == DEFAULT_BIASES

    def test_get_dynamic_sampling_biases_manually_set_biases(self):
        """
        Tests the case when an organization on AM2 plan, and have manipulated the bias toggles,
        so they should get their actual bias preferences.
        """

        new_biases = [{"id": "boostEnvironments", "active": False}]
        self.project.update_option("sentry:dynamic_sampling_biases", new_biases)
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert response.data["dynamicSamplingBiases"] == [
                {"id": "boostEnvironments", "active": False},
                {
                    "id": "boostLatestRelease",
                    "active": True,
                },
                {"id": "ignoreHealthChecks", "active": True},
                {"id": "boostKeyTransactions", "active": True},
                {"id": "boostLowVolumeTransactions", "active": True},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": True},
                {"id": RuleType.RECALIBRATION_RULE.value, "active": True},
            ]

    def test_get_dynamic_sampling_biases_with_previously_assigned_biases(self):
        self.project.update_option(
            "sentry:dynamic_sampling_biases",
            [{"id": "boostEnvironments", "active": False}],
        )

        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert response.data["dynamicSamplingBiases"] == [
                {"id": "boostEnvironments", "active": False},
                {
                    "id": "boostLatestRelease",
                    "active": True,
                },
                {"id": "ignoreHealthChecks", "active": True},
                {"id": "boostKeyTransactions", "active": True},
                {"id": "boostLowVolumeTransactions", "active": True},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": True},
                {"id": RuleType.RECALIBRATION_RULE.value, "active": True},
            ]

    def test_dynamic_sampling_bias_activation(self):
        """
        Tests that when sending a request to enable a dynamic sampling bias,
        the bias will be successfully enabled and the audit log 'SAMPLING_BIAS_ENABLED' will be triggered
        """
        self.project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            ],
        )
        self.login_as(self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        with Feature({self.new_ds_flag: True}), outbox_runner():
            self.client.put(
                url,
                format="json",
                HTTP_AUTHORIZATION=authorization,
                data={
                    "dynamicSamplingBiases": [
                        {"id": "boostEnvironments", "active": True},
                    ]
                },
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=self.project.organization_id,
                event=audit_log.get_event_id("SAMPLING_BIAS_ENABLED"),
            ).exists()

    def test_dynamic_sampling_bias_deactivation(self):
        """
        Tests that when sending a request to disable a dynamic sampling bias,
        the bias will be successfully disabled and the audit log 'SAMPLING_BIAS_DISABLED' will be triggered
        """
        self.project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": True},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            ],
        )
        self.login_as(self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        with Feature({self.new_ds_flag: True}), outbox_runner():
            self.client.put(
                url,
                format="json",
                HTTP_AUTHORIZATION=authorization,
                data={
                    "dynamicSamplingBiases": [
                        {"id": "boostEnvironments", "active": False},
                        {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
                    ]
                },
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=self.project.organization_id,
                event=audit_log.get_event_id("SAMPLING_BIAS_DISABLED"),
            ).exists()

    def test_put_dynamic_sampling_after_migrating_to_new_plan_default_biases_with_missing_flags(
        self,
    ):
        """
        Test for case when a user is an old plan but tries to update dynamic sampling biases that is a
        feature of new plans
        """

        response = self.client.put(
            self.url,
            format="json",
            HTTP_AUTHORIZATION=self.authorization,
            data={"dynamicSamplingBiases": DEFAULT_BIASES},
        )
        assert response.status_code == 403
        assert response.data["detail"] == "dynamicSamplingBiases is not a valid field"

    def test_put_new_dynamic_sampling_rules_with_correct_flags(self):
        """
        Test when user is on a new plan and is trying to update dynamic sampling features of a new plan
        """
        new_biases = [
            {"id": "boostEnvironments", "active": False},
            {
                "id": "boostLatestRelease",
                "active": False,
            },
            {"id": "ignoreHealthChecks", "active": False},
            {"id": "boostKeyTransactions", "active": False},
            {"id": "boostLowVolumeTransactions", "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            {"id": RuleType.RECALIBRATION_RULE.value, "active": False},
        ]
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=self.authorization,
                data={"dynamicSamplingBiases": new_biases},
            )
            assert response.status_code == 200
            assert response.data["dynamicSamplingBiases"] == new_biases

            assert self.project.get_option("sentry:dynamic_sampling_biases") == new_biases

            # Test Get response after dynamic sampling biases are updated
            get_response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert get_response.data["dynamicSamplingBiases"] == new_biases

    def test_put_attempt_new_dynamic_sampling_without_biases_with_correct_flags(self):
        """
        Test when user is on a new plan and is trying to update dynamic sampling features of a new plan with no biases
        """
        with Feature({self.new_ds_flag: True}):
            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=self.authorization,
                data={"dynamicSamplingBiases": []},
            )
            assert response.status_code == 200
            assert response.data["dynamicSamplingBiases"] == DEFAULT_BIASES

            assert self.project.get_option("sentry:dynamic_sampling_biases") == DEFAULT_BIASES

            # Test Get response after dynamic sampling biases are updated
            get_response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert get_response.data["dynamicSamplingBiases"] == DEFAULT_BIASES

    def test_put_new_dynamic_sampling_incorrect_rules_with_correct_flags(self):
        new_biases = [
            {"id": "foo", "active": False},
        ]
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=self.authorization,
                data={"dynamicSamplingBiases": new_biases},
            )
            assert response.status_code == 400
            assert response.json()["dynamicSamplingBiases"][0]["id"] == [
                '"foo" is not a valid choice.'
            ]

            new_biases = [
                {"whatever": "foo", "bla": False},
            ]
            response = self.client.put(
                self.url,
                format="json",
                HTTP_AUTHORIZATION=self.authorization,
                data={"dynamicSamplingBiases": new_biases},
            )
            assert response.status_code == 400
            assert response.json()["dynamicSamplingBiases"][0]["non_field_errors"] == [
                "Error: Only 'id' and 'active' fields are allowed for bias."
            ]

    @with_feature("organizations:tempest-access")
    def test_put_tempest_fetch_screenshots(self):
        # assert default value is False, and that put request updates the value
        assert self.project.get_option("sentry:tempest_fetch_screenshots") is False
        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="put", tempestFetchScreenshots=True
        )
        assert response.data["tempestFetchScreenshots"] is True
        assert self.project.get_option("sentry:tempest_fetch_screenshots") is True

    def test_put_tempest_fetch_screenshots_without_feature_flag(self):
        self.get_error_response(
            self.organization.slug, self.project.slug, method="put", tempestFetchScreenshots=True
        )

    @with_feature("organizations:tempest-access")
    def test_get_tempest_fetch_screenshots_options(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get"
        )
        assert "tempestFetchScreenshots" in response.data
        assert response.data["tempestFetchScreenshots"] is False

    def test_get_tempest_fetch_screenshots_options_without_feature_flag(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get"
        )
        assert "tempestFetchScreenshots" not in response.data
