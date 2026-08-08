from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.calculations import PerOrgCalculations, TransactionVolumeDebug
from sentry.dynamic_sampling.per_org.legacy_comparison import log_comparison_with_legacy_pipeline
from sentry.dynamic_sampling.per_org.queries import ProjectVolume
from sentry.dynamic_sampling.per_org.telemetry import DynamicSamplingStatus
from sentry.testutils.cases import TestCase
from tests.sentry.dynamic_sampling.per_org.test_helpers import mock_configuration

LOGGER_INFO = "sentry.dynamic_sampling.per_org.legacy_comparison.logger.info"

PROJECT_COMPARISON = "dynamic_sampling.per_org.project_balancing_comparison"
IMPLICIT_COMPARISON = "dynamic_sampling.per_org.transaction_balancing_implicit_comparison"
TRANSACTION_COMPARISON = "dynamic_sampling.per_org.transaction_balancing_comparison"
VOLUME_DEBUG = "dynamic_sampling.per_org.transaction_volume_debug"
FACTOR_COMPARISON = "dynamic_sampling.per_org.recalibration_factor_comparison"
SAMPLE_RATES_SUMMARY = "dynamic_sampling.per_org.sample_rates_summary"

Log = tuple[str, dict[str, Any]]


def log_lines(calculations: PerOrgCalculations) -> list[Log]:
    """The messages and extras a finished run is reported with, in the order they are logged."""
    with patch(LOGGER_INFO) as logger_info:
        log_comparison_with_legacy_pipeline(calculations)
    return [(call.args[0], call.kwargs.get("extra", {})) for call in logger_info.call_args_list]


def extras(logs: list[Log], message: str) -> list[dict[str, Any]]:
    return [extra for logged, extra in logs if logged == message]


class ProjectBalancingComparisonTest(TestCase):
    def test_logs_one_line_per_rebalanced_project(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        calculations = PerOrgCalculations(
            config=mock_configuration(org),
            rebalanced_projects=[
                RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
                RebalancedItem(id=project_without_volume.id, count=0, new_sample_rate=1.0),
            ],
            cached_project_sample_rates={
                project_with_volume.id: 0.2,
                project_without_volume.id: 0.96,
            },
            project_volumes=[
                ProjectVolume(project_id=project_with_volume.id, total=200, keep=100, drop=100),
                ProjectVolume(project_id=project_without_volume.id, total=0, keep=0, drop=0),
            ],
        )

        assert extras(log_lines(calculations), PROJECT_COMPARISON) == [
            {
                "org_id": org.id,
                "ds_proj_id": project_with_volume.id,
                "generic_metrics_sample_rate": 0.2,
                "eap_sample_rate": 0.25,
                "relative_deviation": pytest.approx(0.2),
                "is_equal": False,
                "total_volume_eap": 100,
                "total_volume_eap_without_extrapolation": 100,
            },
            {
                "org_id": org.id,
                "ds_proj_id": project_without_volume.id,
                "generic_metrics_sample_rate": 0.96,
                "eap_sample_rate": 1.0,
                "relative_deviation": pytest.approx(0.04),
                "is_equal": True,
                "total_volume_eap": 0,
                "total_volume_eap_without_extrapolation": 0,
            },
        ]

    def test_reports_a_project_the_legacy_pipeline_has_no_rate_for(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        calculations = PerOrgCalculations(
            config=mock_configuration(org),
            rebalanced_projects=[RebalancedItem(id=project.id, count=100, new_sample_rate=0.25)],
        )

        (project_comparison,) = extras(log_lines(calculations), PROJECT_COMPARISON)
        assert project_comparison["generic_metrics_sample_rate"] is None
        assert project_comparison["relative_deviation"] is None
        assert project_comparison["is_equal"] is False
        assert project_comparison["total_volume_eap_without_extrapolation"] is None


class TransactionBalancingComparisonTest(TestCase):
    def test_logs_the_implicit_rate_and_one_line_per_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        calculations = PerOrgCalculations(
            config=mock_configuration(org),
            rebalanced_transactions={
                project.id: (
                    [
                        RebalancedItem(id="checkout", count=100, new_sample_rate=0.25),
                        RebalancedItem(id="cart", count=50, new_sample_rate=0.96),
                    ],
                    0.5,
                ),
            },
            cached_transaction_sample_rates={
                project.id: ({"checkout": 0.2, "cart": 1.0}, 0.45),
            },
        )

        logs = log_lines(calculations)

        assert [message for message, _ in logs] == [
            IMPLICIT_COMPARISON,
            TRANSACTION_COMPARISON,
            TRANSACTION_COMPARISON,
        ]
        assert extras(logs, IMPLICIT_COMPARISON) == [
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "generic_metrics_implicit_rate": 0.45,
                "eap_implicit_rate": 0.5,
                "relative_deviation": pytest.approx(0.1),
                "is_equal": False,
            },
        ]
        assert extras(logs, TRANSACTION_COMPARISON) == [
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "transaction": "checkout",
                "generic_metrics_sample_rate": 0.2,
                "eap_sample_rate": 0.25,
                "relative_deviation": pytest.approx(0.2),
                "is_equal": False,
            },
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "transaction": "cart",
                "generic_metrics_sample_rate": 1.0,
                "eap_sample_rate": 0.96,
                "relative_deviation": pytest.approx(0.04166666666666674),
                "is_equal": True,
            },
        ]

    def test_reports_a_project_the_legacy_pipeline_has_no_rates_for(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        calculations = PerOrgCalculations(
            config=mock_configuration(org),
            rebalanced_transactions={
                project.id: ([RebalancedItem(id="checkout", count=10, new_sample_rate=0.5)], 0.5),
            },
            cached_transaction_sample_rates={project.id: None},
        )

        logs = log_lines(calculations)

        (implicit_comparison,) = extras(logs, IMPLICIT_COMPARISON)
        assert implicit_comparison["generic_metrics_implicit_rate"] is None
        assert implicit_comparison["relative_deviation"] is None
        assert implicit_comparison["is_equal"] is False
        (transaction_comparison,) = extras(logs, TRANSACTION_COMPARISON)
        assert transaction_comparison["generic_metrics_sample_rate"] is None
        assert transaction_comparison["relative_deviation"] is None
        assert transaction_comparison["is_equal"] is False


class TransactionVolumeDebugTest(TestCase):
    def test_logs_the_volumes_of_both_pipelines_per_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        calculations = PerOrgCalculations(
            config=mock_configuration(org),
            transaction_volume_debug=[
                TransactionVolumeDebug(
                    project_id=project.id,
                    eap_volumes={"/checkout": 600.0, "/eap-only": 10.0},
                    generic_metrics_volumes={"/checkout": 580.0, "/legacy-only": 20.0},
                )
            ],
        )

        assert extras(log_lines(calculations), VOLUME_DEBUG) == [
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "transactions": {
                    "/checkout": {"eap_volume": 600.0, "generic_metrics_volume": 580.0},
                    "/eap-only": {"eap_volume": 10.0, "generic_metrics_volume": None},
                    "/legacy-only": {"eap_volume": None, "generic_metrics_volume": 20.0},
                },
            },
        ]


class RecalibrationFactorComparisonTest(TestCase):
    def test_logs_the_deviation(self) -> None:
        org = self.create_organization()
        calculations = PerOrgCalculations(
            config=mock_configuration(org, sample_rate=0.5),
            recalibration_ran=True,
            recalibration_factor=2.8,
            cached_recalibration_factor=2.0,
        )

        assert extras(log_lines(calculations), FACTOR_COMPARISON) == [
            {
                "org_id": org.id,
                "sample_rate": 0.5,
                "generic_metrics_factor": 2.0,
                "eap_factor": 2.8,
                "relative_deviation": pytest.approx(0.2857142857142857),
                "is_equal": False,
            },
        ]

    def test_reports_a_skipped_factor(self) -> None:
        org = self.create_organization()
        calculations = PerOrgCalculations(
            config=mock_configuration(org, sample_rate=0.5),
            recalibration_ran=True,
            recalibration_factor=None,
            cached_recalibration_factor=2.0,
        )

        assert extras(log_lines(calculations), FACTOR_COMPARISON) == [
            {
                "org_id": org.id,
                "sample_rate": 0.5,
                "generic_metrics_factor": 2.0,
                "eap_factor": None,
                "relative_deviation": None,
                "is_equal": False,
            },
        ]

    def test_says_nothing_when_recalibration_did_not_run(self) -> None:
        org = self.create_organization()
        calculations = PerOrgCalculations(config=mock_configuration(org, sample_rate=0.5))

        assert extras(log_lines(calculations), FACTOR_COMPARISON) == []


class SampleRatesSummaryTest(TestCase):
    def calculations_for_both_pipelines(self, summary_log_enabled: bool) -> PerOrgCalculations:
        self.busy_project = self.create_project(organization=self.organization)
        self.quiet_project = self.create_project(organization=self.organization)
        return PerOrgCalculations(
            config=mock_configuration(
                self.organization,
                projects=[self.busy_project, self.quiet_project],
                sample_rate=0.5,
                serving_sample_rate=0.5,
                project_sample_rates={self.busy_project.id: 0.4, self.quiet_project.id: 1.0},
            ),
            rebalanced_transactions={
                self.busy_project.id: (
                    [
                        RebalancedItem(id="/cart", count=200, new_sample_rate=0.45),
                        RebalancedItem(id="/checkout", count=600, new_sample_rate=0.2),
                    ],
                    0.96,
                ),
            },
            cached_organization_sample_rate=0.45,
            cached_project_sample_rates={self.busy_project.id: 0.41, self.quiet_project.id: 0.5},
            cached_transaction_sample_rates={
                self.busy_project.id: None,
                self.quiet_project.id: ({"/api": 0.6}, 0.62),
            },
            summary_log_enabled=summary_log_enabled,
        )

    def test_reports_both_pipelines_side_by_side(self) -> None:
        calculations = self.calculations_for_both_pipelines(summary_log_enabled=True)

        (summary,) = extras(log_lines(calculations), SAMPLE_RATES_SUMMARY)

        assert summary["org_id"] == self.organization.id
        assert summary["eap_org_sample_rate"] == 0.5
        assert summary["eap_org_serving_sample_rate"] == 0.5
        assert summary["generic_metrics_org_sample_rate"] == 0.45
        assert summary["projects"][str(self.busy_project.id)] == {
            "eap_sample_rate": 0.4,
            "generic_metrics_sample_rate": 0.41,
            "eap_transaction_implicit_sample_rate": 0.96,
            "generic_metrics_transaction_implicit_sample_rate": None,
            "eap_transaction_sample_rates": {"/cart": 0.45, "/checkout": 0.2},
            "generic_metrics_transaction_sample_rates": {},
        }
        # The quiet project produced no EAP transaction rates, yet the summary still reports
        # its legacy ones.
        assert summary["projects"][str(self.quiet_project.id)] == {
            "eap_sample_rate": 1.0,
            "generic_metrics_sample_rate": 0.5,
            "eap_transaction_implicit_sample_rate": None,
            "generic_metrics_transaction_implicit_sample_rate": 0.62,
            "eap_transaction_sample_rates": {},
            "generic_metrics_transaction_sample_rates": {"/api": 0.6},
        }

    def test_says_nothing_outside_the_summary_log_rollout(self) -> None:
        calculations = self.calculations_for_both_pipelines(summary_log_enabled=False)

        assert extras(log_lines(calculations), SAMPLE_RATES_SUMMARY) == []


class StoppedRunTest(TestCase):
    def test_says_nothing_about_a_run_that_computed_nothing(self) -> None:
        calculations = PerOrgCalculations(
            config=mock_configuration(self.organization),
            status=DynamicSamplingStatus.NO_ORG_VOLUME,
        )

        assert log_lines(calculations) == []
