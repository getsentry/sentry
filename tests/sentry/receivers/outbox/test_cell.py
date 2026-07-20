import json  # noqa: S003 - urllib3 raises stdlib JSONDecodeError, not simplejson's
from typing import Any
from unittest.mock import Mock, patch

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.receivers.outbox.cell import backfill_scm_integration_config, handle_seer_run_create
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")


class BackfillScmIntegrationConfigReceiverTest(TestCase):
    def _create_oi(
        self,
        provider: str,
        external_id: str,
        config: dict[str, Any] | None = None,
        status: int = ObjectStatus.ACTIVE,
    ) -> OrganizationIntegration:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(
                provider=provider,
                external_id=external_id,
                name=f"{provider}-{external_id}",
            )
            return OrganizationIntegration.objects.create(
                organization_id=self.organization.id,
                integration_id=integration.id,
                status=status,
                config=config or {},
            )

    def _read_config(self, oi: OrganizationIntegration) -> dict[str, Any]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return OrganizationIntegration.objects.get(id=oi.id).config

    def test_backfills_github_keys(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot", "sentry:github_nudge_invite"]},
        )

        assert self._read_config(oi) == {"pr_comments": True, "nudge_invite": True}

    def test_backfills_gitlab_key(self) -> None:
        oi = self._create_oi(provider="gitlab", external_id="gl")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:gitlab_pr_bot"]},
        )

        assert self._read_config(oi) == {"pr_comments": True}

    def test_preserves_existing_config_keys(self) -> None:
        oi = self._create_oi(
            provider="github",
            external_id="gh",
            config={"pr_comments": False, "other": "kept"},
        )

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot", "sentry:github_nudge_invite"]},
        )

        config = self._read_config(oi)
        assert config["pr_comments"] is False
        assert config["nudge_invite"] is True
        assert config["other"] == "kept"

    def test_skips_provider_with_no_matching_keys(self) -> None:
        gl = self._create_oi(provider="gitlab", external_id="gl")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(gl) == {}

    def test_skips_disabled_oi(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh", status=ObjectStatus.DISABLED)

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(oi) == {}

    def test_updates_multiple_active_ois_of_same_provider(self) -> None:
        gh1 = self._create_oi(provider="github", external_id="gh-1")
        gh2 = self._create_oi(provider="github", external_id="gh-2")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(gh1) == {"pr_comments": True}
        assert self._read_config(gh2) == {"pr_comments": True}

    def test_empty_payload_is_noop(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh")

        backfill_scm_integration_config(shard_identifier=self.organization.id, payload={})

        assert self._read_config(oi) == {}

    def test_no_active_oi_for_provider_is_noop(self) -> None:
        # No OI created for the org.
        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )


class HandleSeerRunCreateTest(TestCase):
    def _make_payload(self, body: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "body": body or {"some": "data"},
            "viewer_context": {"organization_id": self.organization.id},
        }

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_happy_path_explorer(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 99}))
        run = self.create_seer_run(type=SeerRunType.EXPLORER)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.seer_run_state_id == 99
        assert run.mirror_status == SeerRunMirrorStatus.LIVE

    @override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_explorer_serializes_monitoring_providers_as_dicts(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 1}))
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(
                provider="datadog",
                external_id="dd-org-uuid",
                name="Datadog",
                metadata={
                    "api_key": "org-api-key",
                    "app_key": "org-app-key",
                    "site": "datadoghq.com",
                },
            )
            org_integration = integration.add_organization(self.organization.id)
            assert org_integration is not None
        run = self.create_seer_run(type=SeerRunType.EXPLORER)

        with self.feature("organizations:seer-infra-telemetry"):
            handle_seer_run_create(
                object_identifier=run.id,
                payload=self._make_payload(),
                shard_identifier=run.id,
            )

        body = mock_request.call_args.args[0]
        providers = body["monitoring_providers"]
        assert providers, "expected an org monitoring connection in the body"
        assert all(isinstance(provider, dict) for provider in providers)
        assert providers[0]["provider_key"] == "datadog"

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_happy_path_assisted_query(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 7}))
        run = self.create_seer_run(type=SeerRunType.ASSISTED_QUERY)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.seer_run_state_id == 7
        assert run.mirror_status == SeerRunMirrorStatus.LIVE

    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_happy_path_feature_run(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 55}))
        run = self.create_seer_run(type=SeerRunType.FEATURE_RUN)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload({"feature_id": "night_shift", "payload": {}}),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.seer_run_state_id == 55
        assert run.mirror_status == SeerRunMirrorStatus.LIVE

        # The handler stamps the SeerRun uuid as both ref and idempotency key.
        sent_body = mock_request.call_args.args[0]
        assert sent_body["feature_id"] == "night_shift"
        assert sent_body["ref"] == str(run.uuid)
        assert sent_body["external_idempotency_key"] == str(run.uuid)

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_idempotent_retry_already_set(self, mock_request: Mock) -> None:
        run = self.create_seer_run(seer_run_state_id=123)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        mock_request.assert_not_called()
        run.refresh_from_db()
        assert run.seer_run_state_id == 123

    def test_missing_run_returns_early(self) -> None:
        handle_seer_run_create(
            object_identifier=999999,
            payload=self._make_payload(),
            shard_identifier=999999,
        )

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_4xx_marks_failed(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=400)
        run = self.create_seer_run()

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_5xx_raises_for_retry(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=502)
        run = self.create_seer_run()

        with pytest.raises(RuntimeError, match="transient error"):
            handle_seer_run_create(
                object_identifier=run.id,
                payload=self._make_payload(),
                shard_identifier=run.id,
            )

        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.PENDING

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_2xx_with_malformed_json_marks_failed(self, mock_request: Mock) -> None:
        response = Mock(status=200)
        response.json.side_effect = json.JSONDecodeError("Expecting value", "", 0)
        mock_request.return_value = response
        run = self.create_seer_run()

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_invalid_payload_marks_failed_without_dispatch(self, mock_request: Mock) -> None:
        run = self.create_seer_run()

        handle_seer_run_create(
            object_identifier=run.id,
            payload={"viewer_context": {}},  # missing "body"
            shard_identifier=run.id,
        )

        mock_request.assert_not_called()
        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    def test_pr_review_marks_failed_instead_of_raising(self) -> None:
        run = self.create_seer_run(type=SeerRunType.PR_REVIEW)

        # Must not raise — raising stalls the outbox shard indefinitely.
        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_2xx_without_run_id_marks_failed(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={}))
        run = self.create_seer_run()

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    @patch("sentry.receivers.outbox.cell._trigger_explorer_indexes_if_needed")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_explorer_calls_index_trigger_with_response_flags(
        self, mock_request: Mock, mock_trigger: Mock
    ) -> None:
        mock_request.return_value = Mock(
            status=200,
            json=Mock(
                return_value={
                    "run_id": 99,
                    "has_explorer_index": False,
                    "has_org_project_context": False,
                }
            ),
        )
        run = self.create_seer_run(type=SeerRunType.EXPLORER)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.seer_run_state_id == 99
        assert run.mirror_status == SeerRunMirrorStatus.LIVE
        mock_trigger.assert_called_once_with(run.organization_id, False, False)

    @patch("sentry.receivers.outbox.cell._trigger_explorer_indexes_if_needed")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_explorer_index_trigger_exception_does_not_fail_run(
        self, mock_request: Mock, mock_trigger: Mock
    ) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 99}))
        mock_trigger.side_effect = RuntimeError("boom")
        run = self.create_seer_run(type=SeerRunType.EXPLORER)

        handle_seer_run_create(
            object_identifier=run.id,
            payload=self._make_payload(),
            shard_identifier=run.id,
        )

        run.refresh_from_db()
        assert run.seer_run_state_id == 99
        assert run.mirror_status == SeerRunMirrorStatus.LIVE
