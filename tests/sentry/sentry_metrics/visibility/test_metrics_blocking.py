from unittest import mock

import pytest

from sentry.sentry_metrics.visibility import (
    MalformedBlockedMetricsPayloadError,
    block_metric,
    get_metrics_blocking_state,
    get_metrics_blocking_state_for_relay_config,
)
from sentry.sentry_metrics.visibility.metrics_blocking import (
    METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY,
    MetricBlocking,
    block_tags_of_metric,
    unblock_metric,
    unblock_tags_of_metric,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@mock.patch("sentry.sentry_metrics.visibility.metrics_blocking.metrics")
@django_db_all
def test_apply_multiple_operations(mock_metrics, default_project):
    mri_1 = "c:custom/page_click@none"
    mri_2 = "g:custom/page_load@millisecond"

    # We block a single metric.
    block_metric(mri_1, [default_project])

    metrics_blocking_state = sorted(
        json.loads(default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)),
        key=lambda v: v["metric_mri"],
    )
    assert len(metrics_blocking_state) == 1
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"] is True
    assert metrics_blocking_state[0]["blocked_tags"] == []
    assert mock_metrics.incr.call_args.args == ("ddm.metrics_api.blocked_metrics_count",)

    # We block tags of a blocked metric.
    block_tags_of_metric(mri_1, {"release", "transaction", "release"}, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 1
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"] is True
    assert sorted(metrics_blocking_state[0]["blocked_tags"]) == ["release", "transaction"]
    assert mock_metrics.incr.call_args.args == ("ddm.metrics_api.blocked_metric_tags_count",)

    # We unblock a tag of a blocked metric.
    unblock_tags_of_metric(mri_1, {"transaction"}, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 1
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"]
    assert sorted(metrics_blocking_state[0]["blocked_tags"]) == ["release"]
    assert mock_metrics.incr.call_args.args == ("ddm.metrics_api.unblocked_metric_tags_count",)

    # We block tags of an unblocked metric.
    block_tags_of_metric(mri_2, {"environment", "transaction"}, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 2
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"] is True
    assert sorted(metrics_blocking_state[0]["blocked_tags"]) == ["release"]
    assert metrics_blocking_state[1]["metric_mri"] == mri_2
    assert metrics_blocking_state[1]["is_blocked"] is False
    assert sorted(metrics_blocking_state[1]["blocked_tags"]) == ["environment", "transaction"]

    # We unblock all the tags of an unblocked metric.
    unblock_tags_of_metric(mri_2, {"environment", "transaction"}, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 1
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"] is True
    assert sorted(metrics_blocking_state[0]["blocked_tags"]) == ["release"]

    # We unblock a blocked metric with blocked tags.
    unblock_metric(mri_1, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 1
    assert metrics_blocking_state[0]["metric_mri"] == mri_1
    assert metrics_blocking_state[0]["is_blocked"] is False
    assert sorted(metrics_blocking_state[0]["blocked_tags"]) == ["release"]
    assert mock_metrics.incr.call_args.args == ("ddm.metrics_api.unblocked_metrics_count",)

    # We unblock all the tags of an unblocked metric.
    unblock_tags_of_metric(mri_1, {"release", "transaction"}, [default_project])

    metrics_blocking_state = json.loads(
        default_project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
    )
    assert len(metrics_blocking_state) == 0


@django_db_all
def test_returns_patched_state(default_project):
    mri = "c:custom/page_click@none"

    metric_blocking = block_metric(mri, [default_project])[default_project.id]
    assert metric_blocking == MetricBlocking(metric_mri=mri, is_blocked=True, blocked_tags=set())

    metric_blocking = block_tags_of_metric(mri, {"release", "transaction"}, [default_project])[
        default_project.id
    ]
    assert metric_blocking == MetricBlocking(
        metric_mri=mri, is_blocked=True, blocked_tags={"release", "transaction"}
    )

    metric_blocking = unblock_metric(mri, [default_project])[default_project.id]
    assert metric_blocking == MetricBlocking(
        metric_mri=mri, is_blocked=False, blocked_tags={"release", "transaction"}
    )

    metric_blocking = unblock_tags_of_metric(mri, {"release", "transaction"}, [default_project])[
        default_project.id
    ]
    assert metric_blocking == MetricBlocking(metric_mri=mri, is_blocked=False, blocked_tags=set())


@django_db_all
def test_get_metrics_blocking_state(default_project):
    mri_1 = "c:custom/page_click@none"
    mri_2 = "g:custom/page_load@millisecond"

    # We test loading with no data stored in the options.
    metrics_blocking_state = get_metrics_blocking_state([default_project])[default_project.id]
    assert len(metrics_blocking_state.metrics) == 0

    block_metric(mri_1, [default_project])
    block_tags_of_metric(mri_2, {"release", "environment", "transaction"}, [default_project])

    metrics_blocking_state = get_metrics_blocking_state([default_project])[default_project.id]
    assert len(metrics_blocking_state.metrics) == 2
    assert sorted(metrics_blocking_state.metrics.values(), key=lambda v: v.metric_mri) == [
        MetricBlocking(metric_mri="c:custom/page_click@none", is_blocked=True, blocked_tags=set()),
        MetricBlocking(
            metric_mri="g:custom/page_load@millisecond",
            is_blocked=False,
            blocked_tags={"environment", "transaction", "release"},
        ),
    ]


@django_db_all
@pytest.mark.parametrize(
    "json_payload",
    [
        "}{",
        "{}",
    ],
)
def test_get_metrics_blocking_state_with_invalid_payload(default_project, json_payload):
    default_project.update_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY, json_payload)

    with pytest.raises(MalformedBlockedMetricsPayloadError):
        get_metrics_blocking_state([default_project])


@django_db_all
def test_get_metrics_blocking_state_for_relay_config(default_project):
    mri_1 = "c:custom/page_click@none"
    mri_2 = "g:custom/page_load@millisecond"
    mri_3 = "d:custom/page_speed@millisecond"

    block_metric(mri_1, [default_project])
    block_tags_of_metric(mri_2, {"release", "environment", "transaction"}, [default_project])
    block_metric(mri_3, [default_project])
    block_tags_of_metric(mri_3, {"environment"}, [default_project])

    metrics_blocking_state = get_metrics_blocking_state_for_relay_config(default_project)
    assert metrics_blocking_state
    assert sorted(metrics_blocking_state["deniedNames"]) == [
        mri_1,
        # Since mri_3 is a blocked metric with blocked tags, we expect that we prioritize it and mark it only as
        # blocked.
        mri_3,
    ]
    assert metrics_blocking_state["deniedTags"][0]["name"] == [mri_2]
    assert sorted(metrics_blocking_state["deniedTags"][0]["tags"]) == [
        "environment",
        "release",
        "transaction",
    ]
