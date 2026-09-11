from unittest.mock import patch

import pytest

from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.feature.dispatch import AutofixFeatureArgs, trigger_autofix_feature
from sentry.seer.autofix.feature.models import RCAStepArgs
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

    def test_dispatches_feature_run(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")
        expected_context = {"org_slug": self.organization.slug, "all_org_projects": []}

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as MockClient,
            patch(
                "sentry.seer.autofix.feature.dispatch.collect_user_org_context",
                return_value=expected_context,
            ) as mock_collect_context,
            patch(
                "sentry.seer.autofix.feature.dispatch.get_proxy_headers",
                return_value={"X-Viewer-Context": "signed-viewer-context"},
            ) as mock_get_proxy_headers,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            client = MockClient.return_value
            client.start_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.NIGHT_SHIFT,
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
        assert client_kwargs["enable_bash_tools"] is False

        # Feature run dispatched with the RCA payload.
        run_kwargs = client.start_feature_run.call_args.kwargs
        assert run_kwargs["feature_id"] == "autofix"
        assert run_kwargs["flush"] is True
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
        # Retained while Seer continues to consume the legacy RCA payload shape.
        assert payload["repo_pins"] == {
            "owner/repo": {
                "sha": "abc123",
                "branch": "main",
                "base_sha": "abc123",
                "base_branch": "main",
            }
        }
        assert payload["tweaks"] == {
            "intelligence_level": "high",
            "reasoning_effort": "low",
            "user_context": "an upstream triage summary",
        }
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
        assert run_kwargs["extras"] == {
            "referrer": AutofixReferrer.NIGHT_SHIFT.value,
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
        }
        assert run_kwargs["referrer"] == AutofixReferrer.NIGHT_SHIFT.value
        assert run_kwargs["user_org_context"] == expected_context
        assert run_kwargs["proxy_headers"] == {"X-Viewer-Context": "signed-viewer-context"}
        mock_collect_context.assert_called_once_with(None, self.group.organization)
        mock_get_proxy_headers.assert_called_once_with()

        # A new run consumes Seer autofix budget.
        mock_quotas.backend.record_seer_run.assert_called_once()

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
                        referrer=AutofixReferrer.NIGHT_SHIFT,
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
                    referrer=AutofixReferrer.NIGHT_SHIFT,
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
                    referrer=AutofixReferrer.NIGHT_SHIFT,
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
                    referrer=AutofixReferrer.NIGHT_SHIFT,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    user=user,
                    enable_bash_tools=True,
                ),
            )

        client_kwargs = mock_client_cls.call_args.kwargs
        assert client_kwargs["user"] == user
        assert client_kwargs["enable_bash_tools"] is True
