import pytest

from sentry.constants import RESERVED_PROJECT_SLUGS
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    DeletedProject,
    EnvironmentProject,
    OrganizationMember,
    OrganizationOption,
    Project,
    ProjectBookmark,
    ProjectOwnership,
    ProjectRedirect,
    ProjectStatus,
    ProjectTeam,
    Rule,
    UserOption,
)
from sentry.api.endpoints.project_details import (
    DynamicSamplingSerializer,
    DynamicSamplingConditionSerializer,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.utils.compat import mock, zip


def _dyn_sampling_data():
    return {
        "rules": [
            {
                "sampleRate": 0.7,
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "field1", "value": ["val"]},
                        {"op": "glob", "name": "field1", "value": ["val"]},
                    ],
                },
                "id": 0,
            },
            {
                "sampleRate": 0.8,
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "field1", "value": ["val"]},
                    ],
                },
                "id": 0,
            },
        ]
    }


def _remove_ids_from_dynamic_rules(dynamic_rules):
    if dynamic_rules.get("next_id") is not None:
        del dynamic_rules["next_id"]
    for rule in dynamic_rules["rules"]:
        del rule["id"]
    return dynamic_rules


class ProjectDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-details"

    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)

        response = self.get_valid_response(project.organization.slug, project.slug)
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

        response = self.get_valid_response(
            project.organization.slug, project.slug, qs_params={"include": "stats"}
        )
        assert response.data["stats"]["unresolved"] == 1

    def test_with_dynamic_sampling_rules(self):
        project = self.project  # force creation
        project.update_option("sentry:dynamic_sampling", _dyn_sampling_data())
        self.login_as(user=self.user)

        response = self.get_valid_response(project.organization.slug, project.slug)
        assert response.data["dynamicSampling"] == _dyn_sampling_data()

    def test_project_renamed_302(self):
        project = self.create_project()
        self.login_as(user=self.user)

        # Rename the project
        self.get_valid_response(
            project.organization.slug, project.slug, method="put", slug="foobar"
        )

        response = self.get_valid_response(project.organization.slug, project.slug, status_code=302)
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

        self.get_valid_response(other_org.slug, "old_slug", status_code=403)


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

        self.get_valid_response(self.org_slug, self.proj_slug, options=options)
        assert project.get_option("mail:subject_prefix") == "[Sentry]"

        options["mail:subject_prefix"] = ""
        self.get_valid_response(self.org_slug, self.proj_slug, options=options)
        assert project.get_option("mail:subject_prefix") == ""

    def test_team_changes_deprecated(self):
        project = self.create_project()
        team = self.create_team(members=[self.user])
        self.login_as(user=self.user)

        resp = self.get_valid_response(
            self.org_slug, self.proj_slug, team=team.slug, status_code=400
        )
        assert resp.data["detail"][0] == "Editing a team via this endpoint has been deprecated."

        project = Project.objects.get(id=project.id)
        assert project.teams.first() != team

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

        self.get_valid_response(
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

        self.get_valid_response(
            self.org_slug,
            self.proj_slug,
            slug="zzz",
            isBookmarked="true",
            status_code=403,
        )

        assert Project.objects.get(id=project.id).slug != "zzz"

        assert not ProjectBookmark.objects.filter(user=user, project_id=project.id).exists()

    def test_name(self):
        self.get_valid_response(self.org_slug, self.proj_slug, name="hello world")
        project = Project.objects.get(id=self.project.id)
        assert project.name == "hello world"

    def test_slug(self):
        self.get_valid_response(self.org_slug, self.proj_slug, slug="foobar")
        project = Project.objects.get(id=self.project.id)
        assert project.slug == "foobar"
        assert ProjectRedirect.objects.filter(project=self.project, redirect_slug=self.proj_slug)
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()

    def test_invalid_slug(self):
        new_project = self.create_project()
        self.get_valid_response(
            self.org_slug,
            self.proj_slug,
            slug=new_project.slug,
            status_code=400,
        )
        project = Project.objects.get(id=self.project.id)
        assert project.slug != new_project.slug

    def test_reserved_slug(self):
        self.get_valid_response(
            self.org_slug,
            self.proj_slug,
            slug=list(RESERVED_PROJECT_SLUGS)[0],
            status_code=400,
        )

    def test_platform(self):
        self.get_valid_response(self.org_slug, self.proj_slug, platform="python")
        project = Project.objects.get(id=self.project.id)
        assert project.platform == "python"

    def test_platform_invalid(self):
        self.get_valid_response(self.org_slug, self.proj_slug, platform="lol", status_code=400)

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
        }
        with self.feature("projects:custom-inbound-filters"):
            self.get_valid_response(self.org_slug, self.proj_slug, options=options)

        project = Project.objects.get(id=self.project.id)
        assert project.get_option("sentry:origins", []) == options["sentry:origins"].split("\n")
        assert project.get_option("sentry:resolve_age", 0) == options["sentry:resolve_age"]
        assert project.get_option("sentry:scrub_data", True) == options["sentry:scrub_data"]
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:scrub_defaults", True) == options["sentry:scrub_defaults"]
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert (
            project.get_option("sentry:sensitive_fields", []) == options["sentry:sensitive_fields"]
        )
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
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
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
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
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:resolve_age", 1)
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert (
            project.get_option("sentry:scrub_ip_address", True)
            == options["sentry:scrub_ip_address"]
        )
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:origins", "*")
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert (
            project.get_option("sentry:scrape_javascript", False)
            == options["sentry:scrape_javascript"]
        )
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:token", "*")
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:token_header", "*")
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()
        assert project.get_option("sentry:verify_ssl", False) == options["sentry:verify_ssl"]
        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_EDIT
        ).exists()

    def test_bookmarks(self):
        self.get_valid_response(self.org_slug, self.proj_slug, isBookmarked="false")
        assert not ProjectBookmark.objects.filter(
            project_id=self.project.id, user=self.user
        ).exists()

    def test_subscription(self):
        self.get_valid_response(self.org_slug, self.proj_slug, isSubscribed="true")
        assert UserOption.objects.get(user=self.user, project=self.project).value == 1

        self.get_valid_response(self.org_slug, self.proj_slug, isSubscribed="false")
        assert UserOption.objects.get(user=self.user, project=self.project).value == 0

    def test_security_token(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, securityToken="fizzbuzz")
        assert self.project.get_security_token() == "fizzbuzz"
        assert resp.data["securityToken"] == "fizzbuzz"

        # can delete
        resp = self.get_valid_response(self.org_slug, self.proj_slug, securityToken="")
        assert self.project.get_security_token() == ""
        assert resp.data["securityToken"] == ""

    def test_security_token_header(self):
        value = "X-Hello-World"
        resp = self.get_valid_response(self.org_slug, self.proj_slug, securityTokenHeader=value)
        assert self.project.get_option("sentry:token_header") == "X-Hello-World"
        assert resp.data["securityTokenHeader"] == "X-Hello-World"

        # can delete
        resp = self.get_valid_response(self.org_slug, self.proj_slug, securityTokenHeader="")
        assert self.project.get_option("sentry:token_header") == ""
        assert resp.data["securityTokenHeader"] == ""

    def test_verify_ssl(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, verifySSL=False)
        assert self.project.get_option("sentry:verify_ssl") is False
        assert resp.data["verifySSL"] is False

    def test_scrub_ip_address(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, scrubIPAddresses=True)
        assert self.project.get_option("sentry:scrub_ip_address") is True
        assert resp.data["scrubIPAddresses"] is True

        resp = self.get_valid_response(self.org_slug, self.proj_slug, scrubIPAddresses=False)
        assert self.project.get_option("sentry:scrub_ip_address") is False
        assert resp.data["scrubIPAddresses"] is False

    def test_scrape_javascript(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, scrapeJavaScript=False)
        assert self.project.get_option("sentry:scrape_javascript") is False
        assert resp.data["scrapeJavaScript"] is False

    def test_default_environment(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, defaultEnvironment="dev")
        assert self.project.get_option("sentry:default_environment") == "dev"
        assert resp.data["defaultEnvironment"] == "dev"

        resp = self.get_valid_response(self.org_slug, self.proj_slug, defaultEnvironment="")
        assert self.project.get_option("sentry:default_environment") == ""
        assert resp.data["defaultEnvironment"] == ""

    def test_resolve_age(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, resolveAge=5)
        assert self.project.get_option("sentry:resolve_age") == 5
        assert resp.data["resolveAge"] == 5

        # can set to 0 or delete
        resp = self.get_valid_response(self.org_slug, self.proj_slug, resolveAge="")
        assert self.project.get_option("sentry:resolve_age") == 0
        assert resp.data["resolveAge"] == 0

    def test_allowed_domains(self):
        value = ["foobar.com", "https://example.com"]
        resp = self.get_valid_response(self.org_slug, self.proj_slug, allowedDomains=value)
        assert self.project.get_option("sentry:origins") == ["foobar.com", "https://example.com"]
        assert resp.data["allowedDomains"] == ["foobar.com", "https://example.com"]

        # cannot be empty
        resp = self.get_valid_response(
            self.org_slug, self.proj_slug, allowedDomains="", status_code=400
        )
        assert self.project.get_option("sentry:origins") == ["foobar.com", "https://example.com"]
        assert resp.data["allowedDomains"] == [
            "Empty value will block all requests, use * to accept from all domains"
        ]

        resp = self.get_valid_response(
            self.org_slug,
            self.proj_slug,
            allowedDomains=["*", ""],
        )
        assert self.project.get_option("sentry:origins") == ["*"]
        assert resp.data["allowedDomains"] == ["*"]

    def test_safe_fields(self):
        value = ["foobar.com", "https://example.com"]
        resp = self.get_valid_response(self.org_slug, self.proj_slug, safeFields=value)
        assert self.project.get_option("sentry:safe_fields") == [
            "foobar.com",
            "https://example.com",
        ]
        assert resp.data["safeFields"] == ["foobar.com", "https://example.com"]

    def test_store_crash_reports(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, storeCrashReports=10)
        assert self.project.get_option("sentry:store_crash_reports") == 10
        assert resp.data["storeCrashReports"] == 10

    def test_relay_pii_config(self):
        value = '{"applications": {"freeform": []}}'
        resp = self.get_valid_response(self.org_slug, self.proj_slug, relayPiiConfig=value)
        assert self.project.get_option("sentry:relay_pii_config") == value
        assert resp.data["relayPiiConfig"] == value

    def test_sensitive_fields(self):
        value = ["foobar.com", "https://example.com"]
        resp = self.get_valid_response(self.org_slug, self.proj_slug, sensitiveFields=value)
        assert self.project.get_option("sentry:sensitive_fields") == [
            "foobar.com",
            "https://example.com",
        ]
        assert resp.data["sensitiveFields"] == ["foobar.com", "https://example.com"]

    def test_data_scrubber(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, dataScrubber=False)
        assert self.project.get_option("sentry:scrub_data") is False
        assert resp.data["dataScrubber"] is False

    def test_data_scrubber_defaults(self):
        resp = self.get_valid_response(self.org_slug, self.proj_slug, dataScrubberDefaults=False)
        assert self.project.get_option("sentry:scrub_defaults") is False
        assert resp.data["dataScrubberDefaults"] is False

    def test_digests_delay(self):
        self.get_valid_response(self.org_slug, self.proj_slug, digestsMinDelay=1000)
        assert self.project.get_option("digests:mail:minimum_delay") == 1000

        self.get_valid_response(self.org_slug, self.proj_slug, digestsMaxDelay=1200)
        assert self.project.get_option("digests:mail:maximum_delay") == 1200

        self.get_valid_response(
            self.org_slug, self.proj_slug, digestsMinDelay=300, digestsMaxDelay=600
        )
        assert self.project.get_option("digests:mail:minimum_delay") == 300
        assert self.project.get_option("digests:mail:maximum_delay") == 600

    def test_digests_min_without_max(self):
        self.get_valid_response(self.org_slug, self.proj_slug, digestsMinDelay=1200)
        assert self.project.get_option("digests:mail:minimum_delay") == 1200

    def test_digests_max_without_min(self):
        self.get_valid_response(self.org_slug, self.proj_slug, digestsMaxDelay=1200)
        assert self.project.get_option("digests:mail:maximum_delay") == 1200

    def test_invalid_digests_min_delay(self):
        min_delay = 120

        self.project.update_option("digests:mail:minimum_delay", min_delay)

        self.get_valid_response(self.org_slug, self.proj_slug, digestsMinDelay=59, status_code=400)
        self.get_valid_response(
            self.org_slug, self.proj_slug, digestsMinDelay=3601, status_code=400
        )

        assert self.project.get_option("digests:mail:minimum_delay") == min_delay

    def test_invalid_digests_max_delay(self):
        min_delay = 120
        max_delay = 360

        self.project.update_option("digests:mail:minimum_delay", min_delay)
        self.project.update_option("digests:mail:maximum_delay", max_delay)

        self.get_valid_response(self.org_slug, self.proj_slug, digestsMaxDelay=59, status_code=400)
        self.get_valid_response(
            self.org_slug, self.proj_slug, digestsMaxDelay=3601, status_code=400
        )

        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

        # test sending only max
        self.get_valid_response(self.org_slug, self.proj_slug, digestsMaxDelay=100, status_code=400)
        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

        # test sending min + invalid max
        self.get_valid_response(
            self.org_slug, self.proj_slug, digestsMinDelay=120, digestsMaxDelay=100, status_code=400
        )
        assert self.project.get_option("digests:mail:minimum_delay") == min_delay
        assert self.project.get_option("digests:mail:maximum_delay") == max_delay

    def test_dynamic_sampling_requires_feature_enabled(self):
        self.get_valid_response(
            self.org_slug, self.proj_slug, dynamicSampling=_dyn_sampling_data(), status_code=403
        )

    def test_setting_dynamic_sampling_rules(self):
        """
        Test that we can set sampling rules
        """
        with Feature({"organizations:filters-and-sampling": True}):
            self.get_valid_response(
                self.org_slug, self.proj_slug, dynamicSampling=_dyn_sampling_data()
            )
        original_config = _dyn_sampling_data()
        saved_config = self.project.get_option("sentry:dynamic_sampling")
        # test that we have unique ids
        ids = set()
        for rule in saved_config["rules"]:
            rid = rule["id"]
            assert rid not in ids
            ids.add(rid)
        next_id = saved_config["next_id"]
        assert next_id not in ids
        # short of ids and next_id the saved config should be the same as the original one
        _remove_ids_from_dynamic_rules(saved_config)
        _remove_ids_from_dynamic_rules(original_config)
        assert original_config == saved_config

    def test_setting_dynamic_sampling_rules_roundtrip(self):
        """
        Tests that we get the same dynamic sampling rules that previously set
        """
        data = _dyn_sampling_data()
        with Feature({"organizations:filters-and-sampling": True}):
            self.get_valid_response(self.org_slug, self.proj_slug, dynamicSampling=data)
            response = self.get_valid_response(self.org_slug, self.proj_slug, method="get")
        saved_config = _remove_ids_from_dynamic_rules(response.data["dynamicSampling"])
        original_data = _remove_ids_from_dynamic_rules(data)
        assert saved_config == original_data

    def test_dynamic_sampling_rule_id_handling(self):
        """
        Tests the assignment of rule ids.

        New rules (having no id or id==0) will be assigned new unique ids.
        Old rules (rules that have ids present in the currently saved config) that have
        not been modified should keep their id.
        Old rules that have been modified (anything changed) should get new ids.
        Once an id is assigned to a rule it should never be reused.
        """
        config = {
            "rules": [
                {
                    "sampleRate": 0.7,
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": 0,
                },
                {
                    "sampleRate": 0.8,
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": 0,
                },
                {
                    "sampleRate": 0.9,
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": 0,
                },
            ]
        }
        with Feature({"organizations:filters-and-sampling": True}):
            self.get_valid_response(self.org_slug, self.proj_slug, dynamicSampling=config)
        response = self.get_valid_response(self.org_slug, self.proj_slug, method="get")
        saved_config = response.data["dynamicSampling"]
        next_id = saved_config["next_id"]
        id1 = saved_config["rules"][0]["id"]
        id2 = saved_config["rules"][1]["id"]
        id3 = saved_config["rules"][2]["id"]
        assert id1 != 0 and id2 != 0 and id3 != 0
        next_id != 0
        assert id1 != id2 and id2 != id3 and id1 != id3
        assert next_id > id1 and next_id > id2 and next_id > id3
        assert response.status_code == 200
        # set it again and see how it handles the id reallocation
        # change first rule
        saved_config["rules"][0]["sampleRate"] = 0.1
        # do not touch the second rule
        # remove third rule (the id should NEVER be reused)
        del saved_config["rules"][2]
        # insert a new element at position 0
        new_rule_1 = {
            "sampleRate": 0.22,
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": 0,
        }

        saved_config["rules"].insert(0, new_rule_1)
        # insert a new element at the end
        new_rule_2 = {
            "sampleRate": 0.33,
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": 0,
        }

        saved_config["rules"].append(new_rule_2)
        with Feature({"organizations:filters-and-sampling": True}):
            # turn it back from ordered dict to dict (both main obj and rules)
            saved_config = dict(saved_config)
            saved_config["rules"] = [dict(rule) for rule in saved_config["rules"]]
            self.get_valid_response(self.org_slug, self.proj_slug, dynamicSampling=saved_config)
        response = self.get_valid_response(self.org_slug, self.proj_slug, method="get")
        saved_config = response.data["dynamicSampling"]
        new_ids = [rule["id"] for rule in saved_config["rules"]]
        # first rule is new, second rule got a new id because it is changed,
        # third rule (used to be second) keeps the id, fourth rule is new
        assert new_ids == [4, 5, 2, 6]
        new_next_id = saved_config["next_id"]
        assert new_next_id == 7


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
        self.get_valid_response(
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
        self.get_valid_response(project.organization.slug, project.slug, **data)
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()

    def test_project_from_another_org(self):
        project = self.create_project(fire_project_created=True)
        other_project = self.create_project(
            organization=self.create_organization(), fire_project_created=True
        )
        resp = self.get_valid_response(
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
        resp = self.get_valid_response(
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
        resp = self.get_valid_response(
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

        resp = self.get_valid_response(
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
        resp = self.get_valid_response(
            project.organization.slug,
            project.slug,
            copy_from_project=self.other_project.id,
            status_code=409,
        )
        assert resp.data == {"detail": ["Copy project settings failed."]}
        self.assert_settings_not_copied(project)
        self.assert_other_project_settings_not_changed()


class ProjectDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-details"
    method = "delete"

    @mock.patch("sentry.db.mixin.uuid4")
    @mock.patch("sentry.api.endpoints.project_details.uuid4")
    @mock.patch("sentry.api.endpoints.project_details.delete_project")
    def test_simple(self, mock_delete_project, mock_uuid4_project, mock_uuid4_mixin):
        mock_uuid4_mixin.return_value = self.get_mock_uuid()
        mock_uuid4_project.return_value = self.get_mock_uuid()
        project = self.create_project()

        self.login_as(user=self.user)

        with self.settings(SENTRY_PROJECT=0):
            self.get_valid_response(project.organization.slug, project.slug, status_code=204)

        mock_delete_project.apply_async.assert_called_once_with(
            kwargs={"object_id": project.id, "transaction_id": "abc123"}, countdown=3600
        )

        deleted_project = Project.objects.get(id=project.id)
        assert deleted_project.status == ProjectStatus.PENDING_DELETION
        assert deleted_project.slug == "abc123"
        assert OrganizationOption.objects.filter(
            organization_id=deleted_project.organization_id,
            key=deleted_project.build_pending_deletion_key(),
        ).exists()
        deleted_project = DeletedProject.objects.get(slug=project.slug)
        self.assert_valid_deleted_log(deleted_project, project)

    @mock.patch("sentry.api.endpoints.project_details.delete_project")
    def test_internal_project(self, mock_delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        with self.settings(SENTRY_PROJECT=project.id):
            self.get_valid_response(project.organization.slug, project.slug, status_code=403)

        assert not mock_delete_project.delay.mock_calls


@pytest.mark.parametrize(
    "condition",
    (
        {"op": "and", "inner": []},
        {"op": "and", "inner": [{"op": "and", "inner": []}]},
        {"op": "or", "inner": []},
        {"op": "or", "inner": [{"op": "or", "inner": []}]},
        {"op": "not", "inner": {"op": "or", "inner": []}},
        {"op": "eq", "ignoreCase": True, "name": "field1", "value": ["val"]},
        {"op": "eq", "name": "field1", "value": ["val"]},
        {"op": "glob", "name": "field1", "value": ["val"]},
    ),
)
def test_condition_serializer_ok(condition):
    serializer = DynamicSamplingConditionSerializer(data=condition)
    assert serializer.is_valid()
    assert serializer.validated_data == condition


@pytest.mark.parametrize(
    "condition",
    (
        {"inner": []},
        {"op": "and"},
        {"op": "or"},
        {"op": "eq", "value": ["val"]},
        {"op": "eq", "name": "field1"},
        {"op": "glob", "value": ["val"]},
        {"op": "glob", "name": "field1"},
    ),
)
def test_bad_condition_serialization(condition):
    serializer = DynamicSamplingConditionSerializer(data=condition)
    assert not serializer.is_valid()


def test_rule_config_serializer():
    data = {
        "rules": [
            {
                "sampleRate": 0.7,
                "type": "trace",
                "id": 1,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "field1", "value": ["val"]},
                        {"op": "glob", "name": "field1", "value": ["val"]},
                    ],
                },
            }
        ],
        "next_id": 22,
    }
    serializer = DynamicSamplingSerializer(data=data)
    assert serializer.is_valid()
    assert data == serializer.validated_data
