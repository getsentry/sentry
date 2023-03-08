from abc import ABC
from time import time
from unittest import mock

from django.urls import reverse

from sentry import audit_log
from sentry.constants import RESERVED_PROJECT_SLUGS
from sentry.dynamic_sampling import DEFAULT_BIASES
from sentry.models import (
    ApiToken,
    AuditLogEntry,
    DeletedProject,
    EnvironmentProject,
    Integration,
    NotificationSetting,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    OrganizationMember,
    OrganizationOption,
    Project,
    ProjectBookmark,
    ProjectOwnership,
    ProjectRedirect,
    ProjectStatus,
    ProjectTeam,
    Rule,
    ScheduledDeletion,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature, faux
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def _dyn_sampling_data(multiple_uniform_rules=False, uniform_rule_last_position=True):
    rules = [
        {
            "sampleRate": 0.7,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "field1", "value": ["val"]},
                    {"op": "glob", "name": "field1", "value": ["val"]},
                ],
            },
            "id": -1,
        },
        {
            "sampleRate": 0.8,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "field1", "value": ["val"]},
                ],
            },
            "id": -1,
        },
    ]
    if uniform_rule_last_position:
        rules.append(
            {
                "sampleRate": 0.8,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [],
                },
                "id": -1,
            },
        )
    if multiple_uniform_rules:
        new_rule_1 = {
            "sampleRate": 0.22,
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": -1,
        }
        rules.insert(0, new_rule_1)

    return {
        "rules": rules,
    }


def _remove_ids_from_dynamic_rules(dynamic_rules):
    if dynamic_rules.get("next_id") is not None:
        del dynamic_rules["next_id"]
    for rule in dynamic_rules["rules"]:
        del rule["id"]
    return dynamic_rules


def first_symbol_source_id(sources_json):
    sources = json.loads(sources_json)
    return sources[0]["id"]


@region_silo_test
class ProjectDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-details"

    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)

        response = self.get_success_response(project.organization.slug, project.slug)
        assert response.data["id"] == str(project.id)

    def test_numeric_org_slug(self):
        # Regression test for https://github.com/getsentry/sentry/issues/2236
        self.login_as(user=self.user)
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        # We want to make sure we don't hit the LegacyProjectRedirect view at all.
        url = f"/api/0/projects/{org.slug}/{project.slug}/"
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == str(project.id)

    def test_with_stats(self):
        project = self.create_project()
        self.create_group(project=project)
        self.login_as(user=self.user)

        response = self.get_success_response(
            project.organization.slug, project.slug, qs_params={"include": "stats"}
        )
        assert response.data["stats"]["unresolved"] == 1

    def test_has_alert_integration(self):
        integration = Integration.objects.create(provider="msteams")
        integration.add_organization(self.organization)

        project = self.create_project()
        self.create_group(project=project)
        self.login_as(user=self.user)

        response = self.get_success_response(
            project.organization.slug,
            project.slug,
            qs_params={"expand": "hasAlertIntegration"},
        )
        assert response.data["hasAlertIntegrationInstalled"]

    def test_no_alert_integration(self):
        integration = Integration.objects.create(provider="jira")
        integration.add_organization(self.organization)

        project = self.create_project()
        self.create_group(project=project)
        self.login_as(user=self.user)

        response = self.get_success_response(
            project.organization.slug, project.slug, qs_params={"expand": "hasAlertIntegration"}
        )
        assert not response.data["hasAlertIntegrationInstalled"]

    def test_project_renamed_302(self):
        project = self.create_project()
        self.login_as(user=self.user)

        # Rename the project
        self.get_success_response(
            project.organization.slug, project.slug, method="put", slug="foobar"
        )

        response = self.get_success_response(
            project.organization.slug, project.slug, status_code=302
        )
        assert (
            AuditLogEntry.objects.get(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).data.get("old_slug")
            == project.slug
        )
        assert (
            AuditLogEntry.objects.get(
                organization_id=project.organization_id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
            ).data.get("new_slug")
            == "foobar"
        )
        assert response.data["slug"] == "foobar"
        assert (
            response.data["detail"]["extra"]["url"]
            == f"/api/0/projects/{project.organization.slug}/foobar/"
        )
        redirect_path = f"/api/0/projects/{project.organization.slug}/foobar/"
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


@region_silo_test
class ProjectUpdateTestTokenAuthenticated(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(platform="javascript")
        self.user = self.create_user("bar@example.com")

    def test_member_can_read_project_details(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.project.teams.first()],
            role="member",
        )

        token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])
        authorization = f"Bearer {token.token}"

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        response = self.client.get(url, format="json", HTTP_AUTHORIZATION=authorization)
        assert response.status_code == 200, response.content

    def test_member_updates_denied_with_token(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.project.teams.first()],
            role="member",
        )

        token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        data = {"platform": "rust"}

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        response = self.client.put(url, format="json", HTTP_AUTHORIZATION=authorization, data=data)
        assert response.status_code == 403, response.content

    def test_admin_updates_allowed_with_correct_token_scope(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.project.teams.first()],
            role="admin",
        )

        token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        data = {"platform": "rust"}

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        response = self.client.put(url, format="json", HTTP_AUTHORIZATION=authorization, data=data)
        assert response.status_code == 200, response.content

    def test_admin_updates_denied_with_token(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.project.teams.first()],
            role="admin",
        )

        # even though the user has the 'admin' role, they've issued a token with only a project:read scope
        token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])
        authorization = f"Bearer {token.token}"

        data = {"platform": "rust"}

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        response = self.client.put(url, format="json", HTTP_AUTHORIZATION=authorization, data=data)
        assert response.status_code == 403, response.content

    def test_empty_token_scopes_denied(self):
        self.create_member(
            user=self.user,
            organization=self.project.organization,
            teams=[self.project.teams.first()],
            role="member",
        )

        token = ApiToken.objects.create(user=self.user, scope_list=[""])
        authorization = f"Bearer {token.token}"

        data = {"platform": "rust"}

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        response = self.client.put(url, format="json", HTTP_AUTHORIZATION=authorization, data=data)
        assert response.status_code == 403, response.content


@region_silo_test
class ProjectUpdateTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.org_slug = self.project.organization.slug
        self.proj_slug = self.project.slug
        self.login_as(user=self.user)

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
        assert not ProjectBookmark.objects.filter(user=user, project_id=self.project.id).exists()

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

        assert not ProjectBookmark.objects.filter(user=user, project_id=project.id).exists()

    def test_name(self):
        self.get_success_response(self.org_slug, self.proj_slug, name="hello world")
        project = Project.objects.get(id=self.project.id)
        assert project.name == "hello world"

    def test_slug(self):
        self.get_success_response(self.org_slug, self.proj_slug, slug="foobar")
        project = Project.objects.get(id=self.project.id)
        assert project.slug == "foobar"
        assert ProjectRedirect.objects.filter(project=self.project, redirect_slug=self.proj_slug)
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
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
        options = {
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
            "feedback:branding": False,
            "filters:react-hydration-errors": True,
        }
        with self.feature("projects:custom-inbound-filters"):
            self.get_success_response(self.org_slug, self.proj_slug, options=options)

        project = Project.objects.get(id=self.project.id)
        assert project.get_option("sentry:origins", []) == options["sentry:origins"].split("\n")
        assert project.get_option("sentry:resolve_age", 0) == options["sentry:resolve_age"]
        assert project.get_option("sentry:scrub_data", True) == options["sentry:scrub_data"]
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:scrub_defaults", True) == options["sentry:scrub_defaults"]
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert (
            project.get_option("sentry:sensitive_fields", []) == options["sentry:sensitive_fields"]
        )
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
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
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
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
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:resolve_age", 1)
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert (
            project.get_option("sentry:scrub_ip_address", True)
            == options["sentry:scrub_ip_address"]
        )
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:origins", "*")
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert (
            project.get_option("sentry:scrape_javascript", False)
            == options["sentry:scrape_javascript"]
        )
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:token", "*")
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:token_header", "*")
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("sentry:verify_ssl", False) == options["sentry:verify_ssl"]
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("feedback:branding") == "0"
        assert AuditLogEntry.objects.filter(
            organization_id=project.organization_id, event=audit_log.get_event_id("PROJECT_EDIT")
        ).exists()
        assert project.get_option("filters:react-hydration-errors", "1")

    def test_bookmarks(self):
        self.get_success_response(self.org_slug, self.proj_slug, isBookmarked="false")
        assert not ProjectBookmark.objects.filter(
            project_id=self.project.id, user=self.user
        ).exists()

    def test_subscription(self):
        self.get_success_response(self.org_slug, self.proj_slug, isSubscribed="true")
        value0 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project,
        )
        assert value0 == NotificationSettingOptionValues.ALWAYS

        self.get_success_response(self.org_slug, self.proj_slug, isSubscribed="false")
        value1 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project,
        )
        assert value1 == NotificationSettingOptionValues.NEVER

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
        value = ["foobar.com", "https://example.com"]
        resp = self.get_success_response(self.org_slug, self.proj_slug, safeFields=value)
        assert self.project.get_option("sentry:safe_fields") == [
            "foobar.com",
            "https://example.com",
        ]
        assert resp.data["safeFields"] == ["foobar.com", "https://example.com"]

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

    def test_react_hydration_errors(self):
        value = False
        options = {"filters:react-hydration-errors": value}
        resp = self.get_success_response(self.org_slug, self.proj_slug, options=options)
        assert self.project.get_option("filters:react-hydration-errors") == value
        assert resp.data["options"]["filters:react-hydration-errors"] == value

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
                self.org_slug, self.proj_slug, symbolSources=json.dumps([config])
            )
            config["id"] = first_symbol_source_id(self.project.get_option("sentry:symbol_sources"))

            assert self.project.get_option("sentry:symbol_sources") == json.dumps([config])

            # redact password
            redacted_source = config.copy()
            redacted_source["password"] = {"hidden-secret": True}

            # check that audit entry was created with redacted password
            assert create_audit_entry.called
            call = faux.faux(create_audit_entry)

            assert call.kwarg_equals(
                "data",
                {
                    "sentry:symbol_sources": [redacted_source],
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "name": self.project.name,
                    "status": self.project.status,
                    "public": self.project.public,
                },
            )

            self.get_success_response(
                self.org_slug, self.proj_slug, symbolSources=json.dumps([redacted_source])
            )
            # on save the magic object should be replaced with the previously set password
            assert self.project.get_option("sentry:symbol_sources") == json.dumps([config])

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
                self.org_slug, self.proj_slug, symbolSources=json.dumps([config])
            )
            config["id"] = first_symbol_source_id(self.project.get_option("sentry:symbol_sources"))

            assert self.project.get_option("sentry:symbol_sources") == json.dumps([config])

            # prepare new call, this secret is not known
            new_source = config.copy()
            new_source["password"] = {"hidden-secret": True}
            new_source["id"] = "oops"
            response = self.get_response(
                self.org_slug, self.proj_slug, symbolSources=json.dumps([new_source])
            )
            assert response.status_code == 400
            assert json.loads(response.content) == {
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

        project.update_option("sentry:symbol_sources", json.dumps([source1, source2]))
        return [source1, source2]

    def test_symbol_sources_no_modification(self):
        source1, source2 = self.symbol_sources()
        project = Project.objects.get(id=self.project.id)
        with Feature({"organizations:custom-symbol-sources": False}):
            resp = self.get_response(
                self.org_slug, self.proj_slug, symbolSources=json.dumps([source1, source2])
            )

            assert resp.status_code == 200
            assert project.get_option("sentry:symbol_sources", json.dumps([source1, source2]))

    def test_symbol_sources_deletion(self):
        source1, source2 = self.symbol_sources()
        project = Project.objects.get(id=self.project.id)
        with Feature({"organizations:custom-symbol-sources": False}):
            resp = self.get_response(
                self.org_slug, self.proj_slug, symbolSources=json.dumps([source1])
            )

            assert resp.status_code == 200
            assert project.get_option("sentry:symbol_sources", json.dumps([source1]))


@region_silo_test
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
        assert rules[0].label == "Send a notification for new issues"

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
        OrganizationMember.objects.filter(user=user, organization=self.organization).update(
            role="admin"
        )

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
        OrganizationMember.objects.filter(user=user, organization=self.organization).update(
            role="admin"
        )

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
        assert resp.data == {"detail": ["Copy project settings failed."]}
        self.assert_settings_not_copied(project)
        self.assert_other_project_settings_not_changed()


@region_silo_test
class ProjectDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "delete"

    @mock.patch("sentry.db.mixin.uuid4")
    def test_simple(self, mock_uuid4_mixin):
        mock_uuid4_mixin.return_value = self.get_mock_uuid()
        project = self.create_project()

        self.login_as(user=self.user)

        with self.settings(SENTRY_PROJECT=0):
            self.get_success_response(project.organization.slug, project.slug, status_code=204)

        assert ScheduledDeletion.objects.filter(model_name="Project", object_id=project.id).exists()

        deleted_project = Project.objects.get(id=project.id)
        assert deleted_project.status == ProjectStatus.PENDING_DELETION
        assert deleted_project.slug == "abc123"
        assert OrganizationOption.objects.filter(
            organization_id=deleted_project.organization_id,
            key=deleted_project.build_pending_deletion_key(),
        ).exists()
        deleted_project = DeletedProject.objects.get(slug=project.slug)
        self.assert_valid_deleted_log(deleted_project, project)

    def test_internal_project(self):
        project = self.create_project()

        self.login_as(user=self.user)

        with self.settings(SENTRY_PROJECT=project.id):
            self.get_error_response(project.organization.slug, project.slug, status_code=403)

        assert not ScheduledDeletion.objects.filter(
            model_name="Project", object_id=project.id
        ).exists()


class TestProjectDetailsDynamicSamplingBase(APITestCase, ABC):
    endpoint = "sentry-api-0-project-details"
    method = "put"

    def setUp(self):
        self.org_slug = self.project.organization.slug
        self.proj_slug = self.project.slug
        self.login_as(user=self.user)
        self.new_ds_flag = "organizations:dynamic-sampling"


@region_silo_test
class TestProjectDetailsDynamicSamplingRules(TestProjectDetailsDynamicSamplingBase):
    endpoint = "sentry-api-0-project-details"

    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user, superuser=True)
        token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.authorization = f"Bearer {token.token}"

    @mock.patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_get_dynamic_sampling_rules_for_superuser_user(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.1
        new_biases = [
            {"id": "boostEnvironments", "active": True},
            {
                "id": "boostLatestRelease",
                "active": False,
            },
            {"id": "ignoreHealthChecks", "active": False},
            {"id": "boostKeyTransactions", "active": False},
        ]
        self.project.update_option("sentry:dynamic_sampling_biases", new_biases)
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="get",
                includeDynamicSamplingRules=1,
            )
            # we expect 2 rules 1 for boostEnvironments and uniform rule
            assert len(response.data["dynamicSamplingRules"]["rules"]) == 0
            assert len(response.data["dynamicSamplingRules"]["rulesV2"]) == 2
            # 1001 is dev bias rule id
            assert response.data["dynamicSamplingRules"]["rulesV2"][0]["id"] == 1001
            # 1000 uniform rule id
            assert response.data["dynamicSamplingRules"]["rulesV2"][1]["id"] == 1000

    def test_get_dynamic_sampling_rules_disabled_if_no_feature_flag(self):
        with Feature(
            {
                self.new_ds_flag: False,
            }
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, method="get"
            )
            assert response.data["dynamicSamplingRules"] is None

    def test_non_superuser_user_trying_to_access_dynamic_sampling_rules(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[team])

        self.create_member(teams=[team], user=user, organization=self.org)
        self.login_as(user=user)
        with Feature(
            {
                self.new_ds_flag: True,
            }
        ):
            response = self.get_success_response(
                self.org.slug, self.project.slug, method="get", includeDynamicSamplingRules=1
            )
            assert "dynamicSamplingRules" not in response.data


@region_silo_test
class TestProjectDetailsDynamicSamplingBiases(TestProjectDetailsDynamicSamplingBase):
    endpoint = "sentry-api-0-project-details"

    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user)
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
                {"id": "boostLowVolumeTransactions", "active": False},
            ]

    def test_get_dynamic_sampling_biases_with_previously_assigned_biases(self):
        self.project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
            ],
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
                {"id": "boostLowVolumeTransactions", "active": False},
            ]

    def test_dynamic_sampling_bias_activation(self):
        """
        Tests that when sending a request to enable a dynamic sampling bias,
        the bias will be successfully enabled and the audit log 'SAMPLING_BIAS_ENABLED' will be triggered
        """

        project = self.project  # force creation
        project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
            ],
        )
        self.login_as(self.user)

        token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        with Feature({self.new_ds_flag: True}):
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

            assert AuditLogEntry.objects.filter(
                organization_id=self.project.organization_id,
                event=audit_log.get_event_id("SAMPLING_BIAS_ENABLED"),
            ).exists()

    def test_dynamic_sampling_bias_deactivation(self):
        """
        Tests that when sending a request to disable a dynamic sampling bias,
        the bias will be successfully disabled and the audit log 'SAMPLING_BIAS_DISABLED' will be triggered
        """

        project = self.project  # force creation
        project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": True},
            ],
        )
        self.login_as(self.user)

        token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        authorization = f"Bearer {token.token}"

        url = reverse(
            "sentry-api-0-project-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        with Feature({self.new_ds_flag: True}):
            self.client.put(
                url,
                format="json",
                HTTP_AUTHORIZATION=authorization,
                data={
                    "dynamicSamplingBiases": [
                        {"id": "boostEnvironments", "active": False},
                    ]
                },
            )

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
        assert response.json()["detail"] == ["dynamicSamplingBiases is not a valid field"]

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
        new_biases = []
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
