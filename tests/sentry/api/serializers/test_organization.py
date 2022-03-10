from unittest import mock

from django.conf import settings
from django.utils import timezone

from sentry import features
from sentry.api.serializers import (
    DetailedOrganizationSerializer,
    DetailedOrganizationSerializerWithProjectsAndTeams,
    OnboardingTasksSerializer,
    serialize,
)
from sentry.auth import access
from sentry.features.base import OrganizationFeature
from sentry.models import OrganizationOnboardingTask
from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.testutils import TestCase


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
            "custom-event-title",
            "custom-symbol-sources",
            "data-forwarding",
            "dashboards-basic",
            "dashboards-edit",
            "discover-basic",
            "discover-query",
            "event-attachments",
            "images-loaded-v2",
            "integrations-alert-rule",
            "integrations-chat-unfurl",
            "integrations-event-hooks",
            "integrations-incident-management",
            "integrations-issue-basic",
            "integrations-issue-sync",
            "integrations-ticket-rules",
            "invite-members",
            "invite-members-rate-limits",
            "minute-resolution-sessions",
            "open-membership",
            "relay",
            "shared-issues",
            "sso-basic",
            "sso-saml2",
            "symbol-sources",
            "team-insights",
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


class DetailedOrganizationSerializerTest(TestCase):
    def test_detailed(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        acc = access.from_user(user, organization)

        serializer = DetailedOrganizationSerializer()
        result = serialize(organization, user, serializer, access=acc)

        assert result["id"] == str(organization.id)
        assert result["role"] == "owner"
        assert result["access"] == settings.SENTRY_SCOPES
        assert result["relayPiiConfig"] is None


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
        assert result["access"] == settings.SENTRY_SCOPES
        assert result["relayPiiConfig"] is None
        assert len(result["teams"]) == 1
        assert len(result["projects"]) == 1


class OnboardingTasksSerializerTest(TestCase):
    def test_onboarding_tasks_serializer(self):
        completion_seen = timezone.now()
        serializer = OnboardingTasksSerializer()
        task = OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.PENDING,
            user=self.user,
            completion_seen=completion_seen,
        )

        result = serialize(task, self.user, serializer)
        assert result["task"] == "create_project"
        assert result["status"] == "pending"
        assert result["completionSeen"] == completion_seen
        assert result["data"] == {}


class TrustedRelaySerializer(TestCase):
    def test_trusted_relay_serializer(self):
        completion_seen = timezone.now()
        serializer = OnboardingTasksSerializer()
        task = OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.PENDING,
            user=self.user,
            completion_seen=completion_seen,
        )

        result = serialize(task, self.user, serializer)
        assert result["task"] == "create_project"
        assert result["status"] == "pending"
        assert result["completionSeen"] == completion_seen
        assert result["data"] == {}
