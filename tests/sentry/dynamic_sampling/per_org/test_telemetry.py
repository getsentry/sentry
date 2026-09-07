from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.results import DynamicSamplingResults
from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
    log_sample_rates_summary,
    track_dynamic_sampling,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.snuba_rpc import SnubaRPCError, SnubaRPCTimeout
from tests.sentry.dynamic_sampling.per_org.test_helpers import mock_configuration

# The metrics sample rate is overridden only so emitting a metric does not read the
# option from the database; none of these tests assert on the emitted metrics.
_GATE_OPTIONS = {
    "dynamic-sampling.per_org.killswitch": False,
    "dynamic-sampling.per_org.metrics-sample-rate": 1.0,
}


@override_options(_GATE_OPTIONS)
def test_reraises_exception() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise ValueError("nope")

    with pytest.raises(ValueError):
        boom()


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_timeout() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise SnubaRPCTimeout("timed out")

    with pytest.raises(SnubaRPCTimeout):
        boom()


@override_options(_GATE_OPTIONS)
def test_reraises_snuba_error() -> None:
    @track_dynamic_sampling
    def boom() -> None:
        raise SnubaRPCError("snuba failed")

    with pytest.raises(SnubaRPCError):
        boom()


@override_options(_GATE_OPTIONS)
def test_passes_result_through() -> None:
    @track_dynamic_sampling
    def add(x: int, y: int) -> int:
        return x + y

    assert add(2, 3) == 5


@override_options(_GATE_OPTIONS)
def test_returns_terminal_status_unchanged() -> None:
    @track_dynamic_sampling
    def skipped() -> DynamicSamplingStatus:
        return DynamicSamplingStatus.NO_ORG_VOLUME

    assert skipped() == DynamicSamplingStatus.NO_ORG_VOLUME


@override_options(_GATE_OPTIONS)
def test_terminal_status_exception_becomes_return_value() -> None:
    @track_dynamic_sampling
    def skipped() -> None:
        raise DynamicSamplingException(DynamicSamplingStatus.NO_SUBSCRIPTION)

    assert skipped() == DynamicSamplingStatus.NO_SUBSCRIPTION


@override_options({**_GATE_OPTIONS, "dynamic-sampling.per_org.killswitch": True})
def test_killswitch_skips_the_wrapped_function() -> None:
    calls: list[None] = []

    @track_dynamic_sampling
    def work() -> str:
        calls.append(None)
        return "ran"

    assert work() == DynamicSamplingStatus.KILLSWITCHED
    assert calls == []


class LogSampleRatesSummaryTest(TestCase):
    def _config(self):
        project = self.create_project(organization=self.organization)
        config = mock_configuration(
            self.organization,
            projects=[project],
            sample_rate=0.5,
            project_sample_rates={project.id: 0.25},
            results=DynamicSamplingResults(
                rebalanced_transactions={
                    project.id: (
                        [RebalancedItem(id="checkout", count=10, new_sample_rate=0.3)],
                        0.4,
                    )
                },
                recalibration_factor=1.5,
            ),
        )
        config.get_serving_sample_rate.return_value = 0.5
        return project, config

    @override_options({"dynamic-sampling.per_org.sample-rates-summary-log-rollout-rate": 1.0})
    def test_logs_the_rates_of_a_pass(self) -> None:
        project, config = self._config()

        with patch("sentry.dynamic_sampling.per_org.telemetry.logger.info") as info:
            log_sample_rates_summary(config)

        info.assert_called_once()
        assert info.call_args.kwargs["extra"] == {
            "org_id": self.organization.id,
            "eap_org_sample_rate": 0.5,
            "eap_org_serving_sample_rate": 0.5,
            "recalibration_factor": 1.5,
            "projects": {
                str(project.id): {
                    "eap_sample_rate": 0.25,
                    "eap_transaction_implicit_sample_rate": 0.4,
                    "eap_transaction_sample_rates": {"checkout": 0.3},
                }
            },
        }

    @override_options({"dynamic-sampling.per_org.sample-rates-summary-log-rollout-rate": 0.0})
    def test_logs_nothing_outside_the_rollout(self) -> None:
        _, config = self._config()

        with patch("sentry.dynamic_sampling.per_org.telemetry.logger.info") as info:
            log_sample_rates_summary(config)

        info.assert_not_called()
