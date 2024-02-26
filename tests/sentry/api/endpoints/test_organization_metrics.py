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
from sentry.utils.samples import load_data

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
class OrganizationMetricsSamplesEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-metrics-samples"
    default_features = ["organizations:metrics-samples-list"]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

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
        span_ids = [uuid4().hex[:16] for _ in range(10)]
        for i, span_id in enumerate(span_ids):
            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                timestamp=before_now(days=i, minutes=10),
                group=uuid4().hex[:16],  # we need a non 0 group
            )

        query = {
            "mri": "d:spans/duration@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 10.0,
                "max": 10.0,
                "sum": 10.0,
                "count": 1,
            }

    def test_transaction_duration_samples(self):
        span_ids = [uuid4().hex[:16] for _ in range(1)]
        for i, span_id in enumerate(span_ids):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            # first write to the transactions dataset
            data = load_data("transaction", timestamp=ts)
            data["contexts"]["trace"]["span_id"] = span_id
            self.store_event(
                data=data,
                project_id=self.project.id,
            )

            # next write to the spans dataset
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                timestamp=ts,
            )

        query = {
            "mri": "d:transactions/duration@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 3000,
                "max": 3000,
                "sum": 3000,
                "count": 1,
            }

    def test_transaction_measurement_samples(self):
        good_span_ids = [uuid4().hex[:16] for _ in range(1)]
        bad_span_ids = [uuid4().hex[:16] for _ in range(1)]
        for i, (good_span_id, bad_span_id) in enumerate(zip(good_span_ids, bad_span_ids)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            # first write to the transactions dataset
            data = load_data("transaction", timestamp=ts)
            # bad span ids will not have the measurement
            data["measurements"] = {}
            data["contexts"]["trace"]["span_id"] = bad_span_id
            self.store_event(
                data=data,
                project_id=self.project.id,
            )

            # next write to the spans dataset
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=bad_span_id,
                timestamp=ts,
            )

            # first write to the transactions dataset
            data = load_data("transaction", timestamp=ts)
            # good span ids will have the measurement
            data["measurements"] = {"lcp": {"value": 10}}
            data["contexts"]["trace"]["span_id"] = good_span_id
            self.store_event(
                data=data,
                project_id=self.project.id,
            )

            # next write to the spans dataset
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=good_span_id,
                timestamp=ts,
            )

        query = {
            "mri": "d:transactions/measurements.lcp@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in good_span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 10.0,
                "max": 10.0,
                "sum": 10.0,
                "count": 1,
            }

    def test_span_measurement_samples(self):
        good_span_ids = [uuid4().hex[:16] for _ in range(1)]
        bad_span_ids = [uuid4().hex[:16] for _ in range(1)]
        for i, (good_span_id, bad_span_id) in enumerate(zip(good_span_ids, bad_span_ids)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=good_span_id,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                measurements={
                    measurement: i + 1
                    for i, measurement in enumerate(
                        [
                            "score.total",
                            "score.inp",
                            "score.weight.inp",
                            "http.response_content_length",
                            "http.decoded_response_content_length",
                            "http.response_transfer_size",
                        ]
                    )
                },
            )
            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=bad_span_id,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
            )

        for i, mri in enumerate(
            [
                "d:spans/webvital.score.total@ratio",
                "d:spans/webvital.score.inp@ratio",
                "d:spans/webvital.score.weight.inp@ratio",
                "d:spans/http.response_content_length@byte",
                "d:spans/http.decoded_response_content_length@byte",
                "d:spans/http.response_transfer_size@byte",
            ]
        ):
            query = {
                "mri": mri,
                "field": ["id"],
                "project": [self.project.id],
                "statsPeriod": "14d",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(span_id, 16) for span_id in good_span_ids}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected, mri

            for row in response.data["data"]:
                assert row["summary"] == {
                    "min": i + 1,
                    "max": i + 1,
                    "sum": i + 1,
                    "count": 1,
                }, mri

    def test_custom_samples(self):
        mri = "d:custom/value@millisecond"
        good_span_ids = [uuid4().hex[:16] for _ in range(1)]
        bad_span_ids = [uuid4().hex[:16] for _ in range(1)]
        for i, (good_span_id, bad_span_id) in enumerate(zip(good_span_ids, bad_span_ids)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=good_span_id,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                store_metrics_summary={
                    mri: [
                        {
                            "min": 10.0,
                            "max": 100.0,
                            "sum": 110.0,
                            "count": 2,
                            "tags": {},
                        }
                    ]
                },
            )
            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=bad_span_id,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                store_metrics_summary={
                    "d:custom/other@millisecond": [
                        {
                            "min": 20.0,
                            "max": 200.0,
                            "sum": 220.0,
                            "count": 3,
                            "tags": {},
                        }
                    ]
                },
            )

        query = {
            "mri": mri,
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in good_span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 10.0,
                "max": 100.0,
                "sum": 110.0,
                "count": 2,
            }
