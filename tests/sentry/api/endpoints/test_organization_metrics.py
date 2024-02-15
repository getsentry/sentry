import copy
from functools import partial
from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.apitoken import ApiToken
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo import SiloMode
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    SessionMRI,
    SingularEntityDerivedMetric,
    complement,
    division_float,
)
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]

MOCKED_DERIVED_METRICS = copy.deepcopy(DERIVED_METRICS)
MOCKED_DERIVED_METRICS.update(
    {
        "crash_free_fake": SingularEntityDerivedMetric(
            metric_mri="crash_free_fake",
            metrics=[
                SessionMRI.CRASHED.value,
                SessionMRI.ERRORED_SET.value,
            ],
            unit="percentage",
            snql=lambda crashed_count, errored_set, entity, metric_ids, alias=None: complement(
                division_float(crashed_count, errored_set, alias=alias), alias="crash_free_fake"
            ),
        )
    }
)


def mocked_mri_resolver(metric_names, mri_func):
    return lambda x: x if x in metric_names else mri_func(x)


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    ret = indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)
    assert ret is not None
    return ret


perf_indexer_record = partial(indexer_record, UseCaseID.TRANSACTIONS)
rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)


@region_silo_test
class OrganizationMetricsPermissionTest(APITestCase):

    endpoints = (
        (
            "get",
            "sentry-api-0-organization-metrics-details",
        ),
        ("get", "sentry-api-0-organization-metric-details", "foo"),
        (
            "get",
            "sentry-api-0-organization-metrics-tags",
        ),
        ("get", "sentry-api-0-organization-metrics-tag-details", "foo"),
        (
            "get",
            "sentry-api-0-organization-metrics-data",
        ),
        (
            "post",
            "sentry-api-0-organization-metrics-query",
        ),
    )

    def send_request(self, token, method, endpoint, *args):
        url = reverse(endpoint, args=(self.project.organization.slug,) + args)
        return getattr(self.client, method)(
            url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json"
        )

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        for method, endpoint, *rest in self.endpoints:
            response = self.send_request(token, method, endpoint, *rest)
            assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for method, endpoint, *rest in self.endpoints:
            response = self.send_request(token, method, endpoint, *rest)
            assert response.status_code in (200, 400, 404)


@region_silo_test
class OrganizationMetricsSamplesEndpointTest(APITestCase, BaseSpansTestCase):
    view = "sentry-api-0-organization-metrics-samples"
    default_features = ["organizations:metrics-samples-list"]

    def setUp(self):
        self.login_as(user=self.user)

    def create_span(self, **kwargs):
        start_ts = kwargs.get("start_ts") or before_now(minutes=10)
        duration = kwargs.get("duration") or 1000
        self_time = kwargs.get("self_time") or duration

        sentry_tags = kwargs.get("sentry_tags") or {}
        if "group" not in sentry_tags:
            sentry_tags["group"] = kwargs.get("group") or uuid4().hex[:16]

        return {
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "event_id": kwargs.get("event_id") or uuid4().hex,
            "trace_id": kwargs.get("trace_id") or uuid4().hex,
            "span_id": kwargs.get("span_id") or uuid4().hex[:16],
            "parent_span_id": kwargs.get("parent_span_id") or uuid4().hex[:16],
            "segment_id": kwargs.get("segment_id") or uuid4().hex[:16],
            "group_raw": kwargs.get("group_raw") or uuid4().hex[:16],
            "profile_id": kwargs.get("profile_id") or uuid4().hex,
            "is_segment": kwargs.get("is_segment", False),
            # Multiply by 1000 cause it needs to be ms
            "start_timestamp_ms": int(start_ts.timestamp() * 1000),
            "timestamp": int(start_ts.timestamp() * 1000),
            "received": start_ts.timestamp(),
            "duration_ms": duration,
            "exclusive_time_ms": self_time,
            "retention_days": 90,
            "tags": kwargs.get("tags") or {},
            "sentry_tags": sentry_tags,
            "measurements": kwargs.get("measurements") or {},
        }

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = self.default_features
        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_feature_flag(self):
        query = {
            "mri": "d:spans/exclusive_time@millisecond",
            "field": ["id"],
            "project": [self.project.id],
        }

        response = self.do_request(query, features=[])
        assert response.status_code == 404, response.data

        response = self.do_request(query, features=["organizations:metrics-samples-list"])
        assert response.status_code == 200, response.data

    def test_no_project(self):
        query = {
            "mri": "d:spans/exclusive_time@millisecond",
            "field": ["id"],
            "project": [],
        }

        response = self.do_request(query)
        assert response.status_code == 404, response.data

    def test_bad_params(self):
        query = {
            "mri": "foo",
            "field": [],
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "mri": [ErrorDetail(string="Invalid MRI: foo", code="invalid")],
            "field": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_span_duration_samples(self):
        spans = [self.create_span(start_ts=before_now(days=i, minutes=10)) for i in range(10)]
        self.store_spans(spans)

        query = {
            "mri": "d:spans/duration@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span["span_id"], 16) for span in spans}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected
