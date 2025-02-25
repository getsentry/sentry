import types

from sentry.issues.grouptype import (
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
)
from sentry.notifications.utils import (
    NPlusOneAPICallProblemContext,
    PerformanceProblemContext,
    RenderBlockingAssetProblemContext,
)
from sentry.testutils.cases import TestCase
from sentry.utils.performance_issues.detector_handlers.n_plus_one_api_calls_detector_handler import (
    PerformanceNPlusOneAPICallsGroupType,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


def mock_event(*, transaction, data=None):
    return types.SimpleNamespace(data=data or {}, transaction=transaction)


class PerformanceProblemContextTestCase(TestCase):
    def test_creates_correct_context(self):
        assert (
            PerformanceProblemContext.from_problem_and_spans(
                PerformanceProblem(
                    fingerprint="",
                    op="",
                    desc="",
                    type=PerformanceNPlusOneGroupType,
                    parent_span_ids=[],
                    cause_span_ids=[],
                    offender_span_ids=[],
                    evidence_data={},
                    evidence_display=[],
                ),
                [],
            ).__class__
            == PerformanceProblemContext
        )

        assert (
            PerformanceProblemContext.from_problem_and_spans(
                PerformanceProblem(
                    fingerprint="",
                    op="",
                    desc="",
                    type=PerformanceNPlusOneAPICallsGroupType,
                    parent_span_ids=[],
                    cause_span_ids=[],
                    offender_span_ids=[],
                    evidence_data={},
                    evidence_display=[],
                ),
                [],
            ).__class__
            == NPlusOneAPICallProblemContext
        )

    def test_returns_n_plus_one_db_query_context(self):
        event = mock_event(transaction="sentry transaction")
        context = PerformanceProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceNPlusOneGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="db",
                desc="SELECT * FROM table",
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=["b93d2be92cd64fd5"],
                cause_span_ids=[],
                offender_span_ids=["054ba3a374d543eb"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {"span_id": "b93d2be92cd64fd5", "description": "SELECT * FROM parent_table"},
                {"span_id": "054ba3a374d543eb", "description": "SELECT * FROM table WHERE id=%s"},
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "sentry transaction",
            "parent_span": "SELECT * FROM parent_table",
            "repeating_spans": "SELECT * FROM table WHERE id=%s",
            "num_repeating_spans": "1",
        }

    def test_returns_n_plus_one_api_call_context(self):
        event = mock_event(transaction="/resources")
        context = NPlusOneAPICallProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceNPlusOneAPICallsGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="http.client",
                desc="/resources",
                type=PerformanceNPlusOneAPICallsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["b93d2be92cd64fd5", "054ba3a374d543eb", "563712f9722fb09"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {
                    "span_id": "b93d2be92cd64fd5",
                    "description": "GET https://resource.io/resource?id=1",
                },
                {
                    "span_id": "054ba3a374d543eb",
                    "description": "GET https://resource.io/resource?id=2",
                },
                {"span_id": "563712f9722fb09", "description": "GET https://resource.io/resource"},
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "/resources",
            "repeating_spans": "/resource",
            "parameters": ["{id: 1,2}"],
            "num_repeating_spans": "3",
        }

    def test_returns_render_blocking_asset_context(self):
        event = mock_event(
            transaction="/details",
            data={
                "start_timestamp": 0,
                "timestamp": 3,
                "measurements": {"fcp": {"value": 1500, "unit": "milliseconds"}},
            },
        )

        context = RenderBlockingAssetProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceRenderBlockingAssetSpanGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="http.client",
                desc="/details",
                type=PerformanceRenderBlockingAssetSpanGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["b93d2be92cd64fd5"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {
                    "op": "resource.script",
                    "span_id": "b93d2be92cd64fd5",
                    "description": "/assets/script.js",
                    "start_timestamp": 1677078164.09656,
                    "timestamp": 1677078165.09656,
                },
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "/details",
            "slow_span_description": "/assets/script.js",
            "slow_span_duration": 1000,
            "transaction_duration": 3000,
            "fcp": 1500,
        }
