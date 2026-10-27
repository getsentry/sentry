from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationOrchestrationCommand,
    InvestigationStatus,
)
from sentry.investigations.services.action_kinds.connect_telemetry import telemetry_available
from sentry.investigations.services.action_requests import upsert_action_request
from sentry.signals import integration_added
from sentry.tasks.seer.investigation import (
    TelemetryNotConnectedYet,
    mark_investigation_telemetry_connected,
)
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from tests.sentry.investigations.test_seer_contract import fixture

TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")
FEATURE = "organizations:seer-infra-telemetry"
USER_LEVEL_AUTH = "organizations:seer-infra-telemetry-user-level-auth"
CONNECT = {"kind": "connect_telemetry", "provider": "datadog"}


class TelemetryFixtures(TestCase):
    def create_datadog(self, **metadata: Any) -> None:
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org",
            name="Datadog",
            metadata={"api_key": "key", "app_key": "app", "site": "datadoghq.com", **metadata},
        )

    def create_gcp(self, *project_statuses: str) -> None:
        config: dict[str, Any] = {
            "sentry_sa_email": "sentry@sentry-connectors.iam.gserviceaccount.com",
            "customer_sa_email": "reader@my-project.iam.gserviceaccount.com",
            "projects": [f"project-{i}" for i in range(max(len(project_statuses), 1))],
        }
        if project_statuses:
            config["connection_status"] = (
                "connected" if set(project_statuses) == {"connected"} else project_statuses[0]
            )
            config["project_statuses"] = [
                {
                    "gcp_project_id": f"project-{i}",
                    "connection_status": status,
                    "services": [],
                    "error_detail": None,
                }
                for i, status in enumerate(project_statuses)
            ]
        self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={"config": config},
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
    def test_gcp_counts_once_a_project_is_verified(self) -> None:
        for statuses in (("unverified",), ("error", "api_disabled")):
            with self.subTest(statuses=statuses):
                self.organization = self.create_organization()
                self.create_gcp(*statuses)

                assert not telemetry_available(self.organization, "gcp")

    @with_feature(FEATURE)
    def test_verified_gcp_is_available(self) -> None:
        for statuses in (("connected",), ("api_disabled", "connected")):
            with self.subTest(statuses=statuses):
                self.organization = self.create_organization()
                self.create_gcp(*statuses)

                assert telemetry_available(self.organization, "gcp")

    @with_feature(FEATURE)
    def test_gcp_installed_before_verification_is_available(self) -> None:
        self.create_gcp()

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

    def suggest(self) -> None:
        # Suggest after connecting, so the install hook has nothing to apply.
        self.action_request = self.create_investigation_action_request(
            investigation=self.investigation,
            key="connect-telemetry-datadog-r1",
            report_revision=1,
            action_kind="connect_telemetry",
            action_payload=CONNECT,
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
        self.suggest()

        assert self.apply(dryRun=True).status_code == 200
        assert self.reloaded().state == InvestigationActionRequestState.SUGGESTED
        response = self.apply()

        assert response.status_code == 200, response.data
        action_request = self.reloaded()
        assert action_request.state == InvestigationActionRequestState.APPLIED
        assert action_request.applied_by_id == self.user.id
        assert action_request.applied_details == {"provider": "datadog"}
        outcome, rerun = InvestigationOrchestrationCommand.objects.filter(
            orchestration_run=self.orchestration_run
        ).order_by("id")
        assert outcome.type == "record_action_outcome"
        assert {"type": rerun.type, **rerun.payload} == fixture("command_rerun_after_connection")
        assert (rerun.expected_workflow_version, rerun.resulting_workflow_version) == (4, 5)
        assert action_request.followup_request_id == rerun.request_id

    def test_a_provider_that_is_not_connected_cannot_be_applied(self) -> None:
        self.suggest()

        assert self.apply(dryRun=True).status_code == 400
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
        self.suggest()

        response = self.apply()

        assert response.status_code == 403
        assert response.data["code"] == "permission_denied"

    def test_without_infra_telemetry_it_is_unsupported(self) -> None:
        self.suggest()

        with self.feature({FEATURE: False}):
            response = self.apply()

        assert response.status_code == 400
        assert response.data["code"] == "unsupported_action"


@with_feature(FEATURE)
@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
class ConnectionHookTest(TelemetryFixtures):
    def setUp(self) -> None:
        super().setUp()
        self.create_datadog()
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

    def connect_request(self, **values: Any) -> InvestigationActionRequest:
        values.setdefault("key", "connect-telemetry-datadog-r1")
        values.setdefault("action_payload", CONNECT)
        return self.create_investigation_action_request(
            investigation=values.pop("investigation", self.investigation),
            report_revision=1,
            action_kind="connect_telemetry",
            **values,
        )

    def commands(self) -> list[InvestigationOrchestrationCommand]:
        return list(
            InvestigationOrchestrationCommand.objects.filter(
                orchestration_run=self.orchestration_run
            ).order_by("id")
        )

    def connected(self, user_id: int | None) -> None:
        mark_investigation_telemetry_connected(self.organization.id, "datadog", user_id)

    def test_a_connection_applies_the_request_like_the_endpoint(self) -> None:
        request = self.connect_request()

        self.connected(self.user.id)

        request.refresh_from_db()
        assert request.state == InvestigationActionRequestState.APPLIED
        assert request.applied_by_id == self.user.id
        assert request.applied_details == {"provider": "datadog"}
        outcome, rerun = self.commands()
        assert {"type": outcome.type, **outcome.payload} == {
            "type": "record_action_outcome",
            "key": "connect-telemetry-datadog-r1",
            "action": CONNECT,
            "reportRevision": 1,
            "outcome": "applied",
            "appliedBy": self.user.id,
        }
        assert {"type": rerun.type, **rerun.payload} == fixture("command_rerun_after_connection")
        assert request.followup_request_id == rerun.request_id

    def test_requests_for_the_same_provider_share_one_re_run(self) -> None:
        first = self.connect_request()
        second = self.connect_request(key="connect-telemetry-datadog-r2")

        self.connected(self.user.id)

        reruns = [command for command in self.commands() if command.type != "record_action_outcome"]
        assert len(reruns) == 1
        for request in (first, second):
            request.refresh_from_db()
            assert request.followup_request_id == reruns[0].request_id

    def test_a_second_hook_for_the_same_connection_does_nothing(self) -> None:
        self.connect_request()
        self.connected(self.user.id)

        self.connected(None)

        assert len(self.commands()) == 2

    def test_only_suggested_requests_for_the_provider_are_applied(self) -> None:
        gcp = self.connect_request(
            key="connect-telemetry-gcp-r1", action_payload={**CONNECT, "provider": "gcp"}
        )
        withdrawn = self.connect_request(
            key="old-connect", state=InvestigationActionRequestState.WITHDRAWN
        )
        other_org = self.create_investigation(
            organization=self.create_organization(), created_by=self.user
        )
        self.create_investigation_orchestration_run(investigation=other_org)
        foreign = self.connect_request(investigation=other_org)

        self.connected(self.user.id)

        for row in (gcp, withdrawn, foreign):
            state = row.state
            row.refresh_from_db()
            assert row.state == state
        assert self.commands() == []

    def test_an_automatic_apply_has_no_applier(self) -> None:
        request = self.connect_request()

        self.connected(None)

        request.refresh_from_db()
        assert request.applied_by_id is None
        outcome, rerun = self.commands()
        assert outcome.payload["appliedBy"] is None
        assert outcome.actor_id is None
        assert rerun.actor_id is None
        assert request.followup_request_id == rerun.request_id

    def test_the_installer_applies_it(self) -> None:
        installer = self.create_user()
        self.create_member(user=installer, organization=self.organization, role="manager")
        self.connect_request()

        self.connected(installer.id)

        outcome, rerun = self.commands()
        assert outcome.payload["appliedBy"] == installer.id
        assert outcome.actor_id == rerun.actor_id == installer.id

    def test_requests_older_than_a_day_are_left_for_the_user(self) -> None:
        old = self.connect_request()
        old.update(date_added=timezone.now() - timedelta(days=1, minutes=1))
        recent = self.connect_request(key="connect-telemetry-datadog-r2")

        self.connected(self.user.id)

        old.refresh_from_db()
        recent.refresh_from_db()
        assert old.state == InvestigationActionRequestState.SUGGESTED
        assert recent.state == InvestigationActionRequestState.APPLIED

    def test_archived_investigations_are_left_alone(self) -> None:
        request = self.connect_request()
        self.investigation.update(status=InvestigationStatus.ARCHIVED)

        self.connected(self.user.id)

        request.refresh_from_db()
        assert request.state == InvestigationActionRequestState.SUGGESTED


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
class MarkInvestigationTelemetryConnectedTaskTest(TelemetryFixtures):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            projection={"workflowVersion": 1, "report": {"revision": 0, "status": "completed"}},
        )
        self.create_investigation_action_request(
            investigation=self.investigation,
            key="connect-telemetry-datadog-r0",
            action_kind="connect_telemetry",
            action_payload=CONNECT,
        )

    def connect_request_state(self) -> str:
        return InvestigationActionRequest.objects.get(investigation=self.investigation).state

    @with_feature(FEATURE)
    def test_applies_requests_once_connected(self) -> None:
        self.create_datadog()

        mark_investigation_telemetry_connected(self.organization.id, "datadog", self.user.id)

        assert self.connect_request_state() == InvestigationActionRequestState.APPLIED

    @with_feature(FEATURE)
    def test_retries_until_the_settings_are_saved(self) -> None:
        with pytest.raises(TelemetryNotConnectedYet):
            mark_investigation_telemetry_connected(self.organization.id, "datadog", None)
        mark_investigation_telemetry_connected(self.organization.id, "datadog", None, retry=False)
        with mock.patch(
            "sentry.tasks.seer.investigation.current_task",
            return_value=mock.Mock(retries_remaining=False),
        ):
            mark_investigation_telemetry_connected(self.organization.id, "datadog", None)

        assert self.connect_request_state() == InvestigationActionRequestState.SUGGESTED

    @with_feature(FEATURE)
    def test_skips_organizations_with_nothing_to_connect(self) -> None:
        # GCP isn't connected, so checking it would ask for a retry.
        mark_investigation_telemetry_connected(self.organization.id, "gcp", None)

    def test_does_nothing_without_infra_telemetry(self) -> None:
        self.create_datadog()

        mark_investigation_telemetry_connected(self.organization.id, "datadog", self.user.id)

        assert self.connect_request_state() == InvestigationActionRequestState.SUGGESTED

    @mock.patch("sentry.receivers.seer.mark_investigation_telemetry_connected.delay")
    def test_an_installed_integration_triggers_the_check(self, delay: mock.MagicMock) -> None:
        datadog = self.create_integration(
            organization=self.organization, provider="datadog", external_id="dd"
        )
        slack = self.create_integration(
            organization=self.organization, provider="slack", external_id="sl"
        )
        delay.reset_mock()

        for integration in (datadog, slack):
            integration_added.send_robust(
                sender=None,
                integration_id=integration.id,
                organization_id=self.organization.id,
                user_id=self.user.id,
            )

        delay.assert_called_once_with(
            organization_id=self.organization.id, provider="datadog", user_id=self.user.id
        )

    @mock.patch("sentry.tasks.seer.investigation.mark_investigation_telemetry_connected.delay")
    def test_a_new_connect_request_schedules_one_check(self, delay: mock.MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            upsert_action_request(
                self.orchestration_run,
                {
                    "key": "connect-telemetry-gcp-r0",
                    "reportRevision": 0,
                    "title": "Connect Google Cloud",
                    "rationale": "Logs live there.",
                    "impact": None,
                    "primary": False,
                    "anchor": None,
                    "action": {"kind": "connect_telemetry", "provider": "gcp"},
                },
            )

        delay.assert_called_once_with(
            organization_id=self.organization.id, provider="gcp", user_id=None, retry=False
        )
