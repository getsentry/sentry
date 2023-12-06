import datetime
from unittest import mock

from django.conf import settings
from django.utils import timezone

from sentry import features, killswitches, options
from sentry.api.serializers import (
    DetailedOrganizationSerializer,
    DetailedOrganizationSerializerWithProjectsAndTeams,
    OnboardingTasksSerializer,
    serialize,
)
from sentry.api.serializers.models.organization import ORGANIZATION_OPTIONS_AS_FEATURES
from sentry.auth import access
from sentry.features.base import OrganizationFeature
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

non_default_owner_scopes = ["org:ci", "openid", "email", "profile"]
default_owner_scopes = frozenset(
    filter(lambda scope: scope not in non_default_owner_scopes, settings.SENTRY_SCOPES)
)

mock_options_as_features = {
    "sentry:set_no_value": [
        ("frontend-flag-1-1", lambda opt: True),
        ("frontend-flag-1-2", lambda opt: True),
    ],
    "sentry:unset_no_value": [
        ("frontend-flag-2-1", lambda opt: True),
        ("frontend-flag-2-2", lambda opt: True),
    ],
    "sentry:set_with_func_pass": [
        ("frontend-flag-3-1", lambda opt: bool(opt.value)),
        ("frontend-flag-3-2", lambda opt: bool(opt.value)),
    ],
    "sentry:set_with_func_fail": [
        ("frontend-flag-4-1", lambda opt: bool(opt.value)),
        ("frontend-flag-4-2", lambda opt: bool(opt.value)),
    ],
}


@region_silo_test
class OrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        result = serialize(organization, user)

        assert result["id"] == str(organization.id)
        assert result["features"] == {
            "advanced-search",
            "change-alerts",
            "crash-rate-alerts",
            "custom-symbol-sources",
            "data-forwarding",
            "dashboards-basic",
            "dashboards-edit",
            "discover-basic",
            "discover-query",
            "derive-code-mappings",
            "event-attachments",
            "integrations-alert-rule",
            "integrations-chat-unfurl",
            "integrations-deployment",
            "dashboard-widget-indicators",
            "integrations-enterprise-alert-rule",
            "integrations-enterprise-incident-management",
            "integrations-event-hooks",
            "integrations-incident-management",
            "integrations-issue-basic",
            "integrations-issue-sync",
            "integrations-stacktrace-link",
            "integrations-ticket-rules",
            "performance-tracing-without-performance",
            "invite-members",
            "invite-members-rate-limits",
            "minute-resolution-sessions",
            "new-page-filter",
            "open-membership",
            "project-stats",
            "relay",
            "shared-issues",
            "session-replay-ui",
            "sso-basic",
            "sso-saml2",
            "symbol-sources",
            "team-insights",
            "team-roles",
            "performance-issues-search",
            "transaction-name-normalize",
            "transaction-name-mark-scrubbed-as-sanitized",
        }

    @mock.patch("sentry.features.batch_has")
    def test_organization_batch_has(self, mock_batch):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        features.add("organizations:test-feature", OrganizationFeature)
        features.add("organizations:disabled-feature", OrganizationFeature)
        mock_batch.return_value = {
            f"organization:{organization.id}": {
                "organizations:test-feature": True,
                "organizations:disabled-feature": False,
            }
        }

        result = serialize(organization, user)
        assert "test-feature" in result["features"]
        assert "disabled-feature" not in result["features"]

    @mock.patch.dict(ORGANIZATION_OPTIONS_AS_FEATURES, mock_options_as_features)
    def test_organization_options_as_features(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        OrganizationOption.objects.set_value(organization, "sentry:set_no_value", {})
        OrganizationOption.objects.set_value(organization, "sentry:set_with_func_pass", 1)
        OrganizationOption.objects.set_value(organization, "sentry:set_with_func_fail", 0)

        features = serialize(organization, user)["features"]

        # Setting a flag with no function checks for option, regardless of value
        for feature, _func in mock_options_as_features["sentry:set_no_value"]:
            assert feature in features
        # If the option isn't set, it doesn't appear in features
        for feature, _func in mock_options_as_features["sentry:unset_no_value"]:
            assert feature not in features
        # With a function, run it against the value
        for feature, _func in mock_options_as_features["sentry:set_with_func_pass"]:
            assert feature in features
        # If it returns False, it doesn't appear in features
        for feature, _func in mock_options_as_features["sentry:set_with_func_fail"]:
            assert feature not in features


@region_silo_test
class DetailedOrganizationSerializerTest(TestCase):
    def test_detailed(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        acc = access.from_user(user, organization)

        serializer = DetailedOrganizationSerializer()
        result = serialize(organization, user, serializer, access=acc)

        assert result["id"] == str(organization.id)
        assert result["role"] == "owner"
        assert result["access"] == default_owner_scopes
        assert result["relayPiiConfig"] is None
        assert isinstance(result["orgRoleList"], list)
        assert isinstance(result["teamRoleList"], list)


@region_silo_test
class DetailedOrganizationSerializerWithProjectsAndTeamsTest(TestCase):
    def test_detailed_org_projs_teams(self):
        # access the test fixtures so they're initialized
        self.team
        self.project
        acc = access.from_user(self.user, self.organization)
        serializer = DetailedOrganizationSerializerWithProjectsAndTeams()
        result = serialize(self.organization, self.user, serializer, access=acc)

        assert result["id"] == str(self.organization.id)
        assert result["role"] == "owner"
        assert result["access"] == default_owner_scopes
        assert result["relayPiiConfig"] is None
        assert len(result["teams"]) == 1
        assert len(result["projects"]) == 1

    def test_disable_last_deploys_killswitch(self):
        self.team
        self.project
        self.release = self.create_release(self.project)
        self.date = datetime.datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc)
        self.environment_1 = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        self.environment_1.add_project(self.project)
        self.environment_1.save()
        deploy = Deploy.objects.create(
            environment_id=self.environment_1.id,
            organization_id=self.organization.id,
            release=self.release,
            date_finished=self.date,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=self.release.id,
            environment_id=self.environment_1.id,
            last_deploy_id=deploy.id,
        )
        acc = access.from_user(self.user, self.organization)
        serializer = DetailedOrganizationSerializerWithProjectsAndTeams()
        result = serialize(self.organization, self.user, serializer, access=acc)

        assert result["projects"][0]["latestDeploys"]

        opt_val = killswitches.validate_user_input(
            "api.organization.disable-last-deploys", [{"organization_id": self.organization.id}]
        )
        options.set("api.organization.disable-last-deploys", opt_val)

        result = serialize(self.organization, self.user, serializer, access=acc)
        assert not result["projects"][0].get("latestDeploys")

        opt_val = killswitches.validate_user_input("api.organization.disable-last-deploys", [])
        options.set("api.organization.disable-last-deploys", opt_val)


@region_silo_test
class OnboardingTasksSerializerTest(TestCase):
    def test_onboarding_tasks_serializer(self):
        completion_seen = timezone.now()
        serializer = OnboardingTasksSerializer()
        task = OrganizationOnboardingTask.objects.create(
            organization_id=self.organization.id,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.PENDING,
            user_id=self.user.id,
            completion_seen=completion_seen,
        )

        result = serialize(task, self.user, serializer)
        assert result["task"] == "create_project"
        assert result["status"] == "pending"
        assert result["completionSeen"] == completion_seen
        assert result["data"] == {}


@region_silo_test
class TrustedRelaySerializer(TestCase):
    def test_trusted_relay_serializer(self):
        completion_seen = timezone.now()
        serializer = OnboardingTasksSerializer()
        task = OrganizationOnboardingTask.objects.create(
            organization_id=self.organization.id,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.PENDING,
            user_id=self.user.id,
            completion_seen=completion_seen,
        )

        result = serialize(task, self.user, serializer)
        assert result["task"] == "create_project"
        assert result["status"] == "pending"
        assert result["completionSeen"] == completion_seen
        assert result["data"] == {}
