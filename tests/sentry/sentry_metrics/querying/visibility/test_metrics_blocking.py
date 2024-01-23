import pytest

from sentry.sentry_metrics.visibility import (
    BlockedMetric,
    InvalidBlockedMetricError,
    MalformedBlockedMetricsPayloadError,
    block_metric,
    get_blocked_metrics,
    get_blocked_metrics_for_relay_config,
)
from sentry.sentry_metrics.visibility.metrics_blocking import BLOCKED_METRICS_PROJECT_OPTION_KEY
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@django_db_all
def test_block_metric(default_project):
    data = (
        ("c:custom/page_click@none", set()),
        # We test with duplicated tags.
        ("c:custom/page_click@none", {"release", "release"}),
        ("g:custom/page_load@millisecond", set()),
    )
    for mri, tags in data:
        block_metric(BlockedMetric(metric_mri=mri, tags=set(tags)), [default_project])

    blocked_metrics = json.loads(default_project.get_option(BLOCKED_METRICS_PROJECT_OPTION_KEY))
    assert sorted(blocked_metrics, key=lambda v: v["metric_mri"]) == [
        {"metric_mri": data[0][0], "tags": ["release"]},
        {"metric_mri": data[2][0], "tags": []},
    ]


@django_db_all
def test_get_blocked_metrics(default_project):
    data = (
        ("c:custom/page_click@none", {"release", "release"}),
        ("g:custom/page_load@millisecond", {"transaction"}),
    )
    for mri, tags in data:
        block_metric(BlockedMetric(metric_mri=mri, tags=set(tags)), [default_project])

    blocked_metrics = get_blocked_metrics([default_project])[default_project.id]
    assert len(blocked_metrics.metrics) == 2
    assert blocked_metrics.metrics[0] == BlockedMetric(data[0][0], data[0][1])
    assert blocked_metrics.metrics[1] == BlockedMetric(data[1][0], data[1][1])


@django_db_all
@pytest.mark.parametrize(
    "json_payload, expected_error",
    [
        ("}{", MalformedBlockedMetricsPayloadError),
        ("{}", MalformedBlockedMetricsPayloadError),
        ('[{"tags": []}]', InvalidBlockedMetricError),
    ],
)
def test_get_blocked_metrics_with_invalid_payload(default_project, json_payload, expected_error):
    default_project.update_option(BLOCKED_METRICS_PROJECT_OPTION_KEY, json_payload)

    with pytest.raises(expected_error):
        get_blocked_metrics([default_project])


@django_db_all
def test_get_blocked_metrics_for_relay_config(default_project):
    data = (
        ("c:custom/page_click@none", {"release", "release"}),
        ("g:custom/page_load@millisecond", {"transaction"}),
    )
    for mri, tags in data:
        block_metric(BlockedMetric(metric_mri=mri, tags=set(tags)), [default_project])

    blocked_metrics = get_blocked_metrics_for_relay_config(default_project)
    # For now, no tags are emitted to Relay, even though they are supported by the backend.
    assert sorted(blocked_metrics["deniedNames"]) == [
        "c:custom/page_click@none",
        "g:custom/page_load@millisecond",
    ]
