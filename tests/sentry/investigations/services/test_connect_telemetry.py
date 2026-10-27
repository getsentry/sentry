from __future__ import annotations

from typing import Any

from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse

from sentry.investigations.models import (
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationOrchestrationCommand,
)
from sentry.investigations.services.action_kinds.connect_telemetry import telemetry_available
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature

TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")
FEATURE = "organizations:seer-infra-telemetry"
USER_LEVEL_AUTH = "organizations:seer-infra-telemetry-user-level-auth"


class TelemetryFixtures(TestCase):
    def create_datadog(self, **metadata: Any) -> None:
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org",
            name="Datadog",
            metadata={"api_key": "key", "app_key": "app", "site": "datadoghq.com", **metadata},
        )

    def create_gcp(self, connection_status: str) -> None:
        self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={
                "config": {
                    "sentry_sa_email": "sentry@sentry-connectors.iam.gserviceaccount.com",
                    "customer_sa_email": "reader@my-project.iam.gserviceaccount.com",
                    "projects": ["my-project-prod"],
                    "connection_status": connection_status,
                }
            },
        )


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
class TelemetryAvailableTest(TelemetryFixtures):
    @with_feature(FEATURE)
    def test_an_installed_datadog_integration_is_available(self) -> None:
        assert not telemetry_available(self.organization, "datadog")

        self.create_datadog()

        assert telemetry_available(self.organization, "datadog")
        assert not telemetry_available(self.organization, "gcp")

    @with_feature(FEATURE)
    def test_an_unconfigured_datadog_integration_is_not_available(self) -> None:
        self.create_datadog(app_key=None)

        assert not telemetry_available(self.organization, "datadog")

    @with_feature(FEATURE)
    def test_gcp_counts_once_its_settings_are_verified(self) -> None:
        self.create_gcp("unverified")

        assert not telemetry_available(self.organization, "gcp")

    @with_feature(FEATURE)
    def test_verified_gcp_is_available(self) -> None:
        self.create_gcp("connected")

        assert telemetry_available(self.organization, "gcp")

    @with_feature({FEATURE: True, USER_LEVEL_AUTH: True})
    def test_a_personal_connection_does_not_make_the_org_connected(self) -> None:
        identity = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(type="datadog", external_id=""),
            external_id="datadog-user",
            data={"access_token": "token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(organization=self.organization, identity=identity)

        assert not telemetry_available(self.organization, "datadog")


@with_feature({"organizations:investigations": True, FEATURE: True})
@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
class ConnectTelemetryApplyTest(APITestCase, TelemetryFixtures):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            workflow_version=4,
            phase="completed",
            status="completed",
            projection={"workflowVersion": 4, "report": {"revision": 1, "status": "completed"}},
        )
        self.action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="connect-telemetry-datadog-r1",
            report_revision=1,
            action_kind="connect_telemetry",
            action_payload={"kind": "connect_telemetry", "provider": "datadog"},
        )

    def apply(self, **data: Any) -> Any:
        url = reverse(
            "sentry-api-0-organization-investigation-action-request-apply",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "action_request_id": self.action_request.id,
            },
        )
        return self.client.post(url, data=data, format="json")

    def reloaded(self) -> InvestigationActionRequest:
        self.action_request.refresh_from_db()
        return self.action_request

    def test_applying_a_connected_provider_records_it(self) -> None:
        self.create_datadog()

        response = self.apply()

        assert response.status_code == 200, response.data
        action_request = self.reloaded()
        assert action_request.state == InvestigationActionRequestState.APPLIED
        assert action_request.applied_by_id == self.user.id
        assert action_request.applied_details == {"provider": "datadog"}
        assert [
            command.type
            for command in InvestigationOrchestrationCommand.objects.filter(
                orchestration_run=self.orchestration_run
            )
        ] == ["record_action_outcome"]

    def test_a_provider_that_is_not_connected_cannot_be_applied(self) -> None:
        response = self.apply()

        assert response.status_code == 400
        assert response.data == {
            "detail": "The change wasn't valid.",
            "code": "validation_failed",
            "messages": ["This provider isn't connected yet."],
        }
        assert self.reloaded().state == InvestigationActionRequestState.SUGGESTED

    def test_members_who_cannot_install_get_permission_denied_before_the_connection_check(
        self,
    ) -> None:
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)

        response = self.apply()

        assert response.status_code == 403
        assert response.data["code"] == "permission_denied"

    def test_without_infra_telemetry_it_is_unsupported(self) -> None:
        with self.feature({FEATURE: False}):
            response = self.apply()

        assert response.status_code == 400
        assert response.data["code"] == "unsupported_action"

    def test_a_dry_run_says_whether_the_provider_is_connected(self) -> None:
        assert self.apply(dryRun=True).status_code == 400

        self.create_datadog()

        assert self.apply(dryRun=True).status_code == 200
        assert self.reloaded().state == InvestigationActionRequestState.SUGGESTED
