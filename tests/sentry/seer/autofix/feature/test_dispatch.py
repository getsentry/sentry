from unittest.mock import patch

import pytest

from sentry.constants import DataCategory
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.feature.dispatch import AutofixFeatureArgs, trigger_autofix_feature
from sentry.seer.autofix.feature.models import LEGACY_FEATURE_ID, RCAStepArgs
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestTriggerAutofixFeature(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_continues_feature_run(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        self.create_seer_agent_run(run=fake_run, source=LEGACY_FEATURE_ID)

        with (
            patch(
                "sentry.seer.autofix.feature.dispatch.SeerAgentClient", autospec=True
            ) as MockClient,
            patch(
                "sentry.seer.autofix.feature.dispatch.get_proxy_headers",
                return_value={"X-Viewer-Context": "signed-viewer-context"},
            ) as mock_get_proxy_headers,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            client = MockClient.return_value
            client.continue_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    existing_run_id=123,
                    insert_index=4,
                    user_context="an upstream triage summary",
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                    step_args=RCAStepArgs(
                        intelligence_level="high",
                        reasoning_effort="low",
                        repo_pins={
                            "owner/repo": {
                                "sha": "abc123",
                                "branch": "main",
                                "base_sha": "abc123",
                                "base_branch": "main",
                            }
                        },
                    ),
                ),
            )

        assert run is fake_run

        # Client scoped to the issue's org/project/group.
        client_kwargs = MockClient.call_args.kwargs
        assert client_kwargs["organization"] == self.group.organization
        assert client_kwargs["project"] == self.group.project
        assert client_kwargs["group"] == self.group
        assert client_kwargs["enable_bash_mode"] is False

        # A rerun uses the existing mirror rather than creating another one.
        run_kwargs = client.continue_feature_run.call_args.kwargs
        assert run_kwargs["existing_agent_run"].run == fake_run
        assert run_kwargs["existing_agent_run"].source == LEGACY_FEATURE_ID
        assert "flush" not in run_kwargs
        payload = run_kwargs["payload"]
        assert payload["group_id"] == self.group.id
        assert payload["project_id"] == self.group.project_id
        assert payload["step"] == AutofixStep.ROOT_CAUSE
        assert payload["existing_run_id"] == 123
        assert payload["insert_index"] == 4
        assert payload["short_id"] == (self.group.qualified_short_id or str(self.group.id))
        assert payload["title"] == self.group.title
        assert payload["user_context"] == "an upstream triage summary"
        assert payload["stopping_point"] == AutofixStoppingPoint.OPEN_PR.value
        assert "repo_pins" not in payload
        assert "tweaks" not in payload
        assert payload["step_args"] == {
            "intelligence_level": "high",
            "reasoning_effort": "low",
            "repo_pins": {
                "owner/repo": {
                    "sha": "abc123",
                    "branch": "main",
                    "base_sha": "abc123",
                    "base_branch": "main",
                }
            },
        }
        # Seer persists this hook on the Explorer run so later PR iteration
        # completions continue through the Autofix completion flow.
        assert payload["on_completion_hook"] == {
            "module_path": AutofixOnCompletionHook.get_module_path(),
            "call_on_failure": True,
        }
        assert run_kwargs["referrer"] == AutofixReferrer.AGENTIC_TRIAGE.value
        assert run_kwargs["proxy_headers"] == {"X-Viewer-Context": "signed-viewer-context"}
        mock_get_proxy_headers.assert_called_once_with()

        client.start_feature_run.assert_not_called()
        mock_quotas.backend.check_seer_quota.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_starts_feature_run_and_records_quota(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                ),
            )

        assert run is fake_run
        mock_quotas.backend.check_seer_quota.assert_called_once_with(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        mock_quotas.backend.record_seer_run.assert_called_once_with(
            self.organization.id,
            self.project.id,
            DataCategory.SEER_AUTOFIX,
        )
        mock_client_cls.return_value.continue_feature_run.assert_not_called()
        start_kwargs = mock_client_cls.return_value.start_feature_run.call_args.kwargs
        assert start_kwargs["title"] == (
            f"Autofix RCA — {self.group.qualified_short_id or self.group.id}"
        )
        assert start_kwargs["flush"] is True
        assert start_kwargs["extras"] == {
            "referrer": AutofixReferrer.AGENTIC_TRIAGE.value,
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
        }

    def test_raises_when_out_of_budget(self) -> None:
        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = False

            with pytest.raises(NoSeerQuotaException):
                trigger_autofix_feature(
                    self.group,
                    AutofixFeatureArgs(
                        referrer=AutofixReferrer.AGENTIC_TRIAGE,
                        step=AutofixStep.ROOT_CAUSE,
                        step_args=RCAStepArgs(),
                    ),
                )

        MockClient.return_value.start_feature_run.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_free_cohort_skips_quota_check_and_usage_recording(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
            patch("sentry.seer.autofix.feature.dispatch.is_free_cohort_org", return_value=True),
        ):
            MockClient.return_value.start_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    allow_free_cohort=True,
                ),
            )

        assert run is fake_run
        mock_quotas.backend.check_seer_quota.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_allows_async_dispatch(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    flush=False,
                ),
            )

        assert mock_client_cls.return_value.start_feature_run.call_args.kwargs["flush"] is False

    def test_forwards_run_options_to_client(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")
        user = self.create_user()

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    user=user,
                    enable_bash_mode=True,
                ),
            )

        client_kwargs = mock_client_cls.call_args.kwargs
        assert client_kwargs["user"] == user
        assert client_kwargs["enable_bash_mode"] is True
