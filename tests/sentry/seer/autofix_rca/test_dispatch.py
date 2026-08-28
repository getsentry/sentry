from unittest.mock import patch

import pytest

from sentry.seer.autofix.autofix_agent import NoSeerQuotaException
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.autofix_rca.dispatch import trigger_autofix_rca_feature
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestTriggerAutofixRCAFeature(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_dispatches_feature_run(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix_rca.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix_rca.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            client = MockClient.return_value
            client.start_feature_run.return_value = fake_run

            run = trigger_autofix_rca_feature(
                self.group,
                referrer=AutofixReferrer.NIGHT_SHIFT,
                user_context="an upstream triage summary",
                stopping_point=AutofixStoppingPoint.OPEN_PR,
            )

        assert run is fake_run

        # Client scoped to the issue's org/project/group.
        client_kwargs = MockClient.call_args.kwargs
        assert client_kwargs["organization"] == self.group.organization
        assert client_kwargs["project"] == self.group.project
        assert client_kwargs["group"] == self.group

        # Feature run dispatched with the RCA payload.
        run_kwargs = client.start_feature_run.call_args.kwargs
        assert run_kwargs["feature_id"] == "autofix"
        assert run_kwargs["flush"] is True
        payload = run_kwargs["payload"]
        assert payload["group_id"] == self.group.id
        assert payload["short_id"] == (self.group.qualified_short_id or str(self.group.id))
        assert payload["title"] == self.group.title
        assert payload["tweaks"]["user_context"] == "an upstream triage summary"
        # Seer persists this hook on the Explorer run so later PR iteration
        # completions continue through the Autofix completion flow.
        assert payload["on_completion_hook"] == {
            "module_path": AutofixOnCompletionHook.get_module_path()
        }
        assert run_kwargs["extras"] == {
            "referrer": AutofixReferrer.NIGHT_SHIFT.value,
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
        }
        assert run_kwargs["referrer"] == AutofixReferrer.NIGHT_SHIFT.value

        # A new run consumes Seer autofix budget.
        mock_quotas.backend.record_seer_run.assert_called_once()

    def test_raises_when_out_of_budget(self) -> None:
        with (
            patch("sentry.seer.autofix_rca.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix_rca.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = False

            with pytest.raises(NoSeerQuotaException):
                trigger_autofix_rca_feature(
                    self.group,
                    referrer=AutofixReferrer.NIGHT_SHIFT,
                )

        MockClient.return_value.start_feature_run.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_allows_async_dispatch(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix_rca.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix_rca.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_rca_feature(
                self.group,
                referrer=AutofixReferrer.NIGHT_SHIFT,
                flush=False,
            )

        assert mock_client_cls.return_value.start_feature_run.call_args.kwargs["flush"] is False
