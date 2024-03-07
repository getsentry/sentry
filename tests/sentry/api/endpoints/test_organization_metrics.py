import copy
from datetime import timedelta
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

    def test_unsupported_mri(self):
        query = {
            "mri": "d:spans/made_up@none",
            "field": ["id"],
            "project": [self.project.id],
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                string="Unsupported MRI: d:spans/made_up@none", code="parse_error"
            )
        }

    def test_unsupported_sort(self):
        query = {
            "mri": "d:spans/exclusive_time@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "sort": "id",
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(string="Unsupported sort: id for MRI", code="parse_error")
        }

    def test_span_exclusive_time_samples(self):
        durations = [100, 200, 300]
        span_ids = [uuid4().hex[:16] for _ in durations]
        good_span_id = span_ids[1]

        for i, (span_id, duration) in enumerate(zip(span_ids, durations)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                duration=duration,
                exclusive_time=duration,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
            )

        query = {
            "mri": "d:spans/exclusive_time@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "min": 150,
            "max": 250,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(good_span_id, 16)}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 200.0,
                "max": 200.0,
                "sum": 200.0,
                "count": 1,
            }

        query = {
            "mri": "d:spans/duration@millisecond",
            "field": ["id", "span.self_time"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "sort": "-span.self_time",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for duration, row in zip(reversed(durations), response.data["data"]):
            assert row["summary"] == {
                "min": duration,
                "max": duration,
                "sum": duration,
                "count": 1,
            }

    def test_span_measurement_samples(self):
        durations = [100, 200, 300]
        span_ids = [uuid4().hex[:16] for _ in durations]
        good_span_id = span_ids[1]

        for i, (span_id, duration) in enumerate(zip(span_ids, durations)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)

            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                duration=duration,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                measurements={
                    measurement: duration + j + 1
                    for j, measurement in enumerate(
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
                span_id=uuid4().hex[:16],
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
                "min": 150.0,
                "max": 250.0,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(good_span_id, 16)}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected, mri

            for row in response.data["data"]:
                assert row["summary"] == {
                    "min": 201 + i,
                    "max": 201 + i,
                    "sum": 201 + i,
                    "count": 1,
                }, mri

            query = {
                "mri": mri,
                "field": ["id", "span.duration"],
                "project": [self.project.id],
                "statsPeriod": "14d",
                "sort": "-span.duration",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(span_id, 16) for span_id in span_ids}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected, mri

            for duration, row in zip(reversed(durations), response.data["data"]):
                assert row["summary"] == {
                    "min": duration + i + 1,
                    "max": duration + i + 1,
                    "sum": duration + i + 1,
                    "count": 1,
                }, mri

    def test_transaction_duration_samples(self):
        durations = [100, 200, 300]
        span_ids = [uuid4().hex[:16] for _ in durations]
        good_span_id = span_ids[1]

        for i, (span_id, duration) in enumerate(zip(span_ids, durations)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)
            start_ts = ts - timedelta(microseconds=duration * 1000)

            # first write to the transactions dataset
            data = load_data("transaction", start_timestamp=start_ts, timestamp=ts)
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
                duration=duration,
                span_id=span_id,
                timestamp=ts,
            )

        query = {
            "mri": "d:transactions/duration@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "min": 150,
            "max": 250,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(good_span_id, 16)}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 200,
                "max": 200,
                "sum": 200,
                "count": 1,
            }

        query = {
            "mri": "d:transactions/duration@millisecond",
            "field": ["id", "span.duration"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "sort": "-span.duration",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for duration, row in zip(reversed(durations), response.data["data"]):
            assert row["summary"] == {
                "min": duration,
                "max": duration,
                "sum": duration,
                "count": 1,
            }

    def test_transaction_measurement_samples(self):
        durations = [100, 200, 300]
        span_ids = [uuid4().hex[:16] for _ in durations]
        good_span_id = span_ids[1]

        for i, (span_id, duration) in enumerate(zip(span_ids, durations)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)
            start_ts = ts - timedelta(microseconds=duration * 1000)

            # first write to the transactions dataset
            data = load_data("transaction", start_timestamp=start_ts, timestamp=ts)
            # good span ids will have the measurement
            data["measurements"] = {"lcp": {"value": duration}}
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
                duration=duration,
                span_id=span_id,
                timestamp=ts,
            )

        span_id = uuid4().hex[:16]
        ts = before_now(days=10, minutes=10).replace(microsecond=0)

        # first write to the transactions dataset
        data = load_data("transaction", timestamp=ts)
        # bad span ids will not have the measurement
        data["measurements"] = {}
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
            "mri": "d:transactions/measurements.lcp@millisecond",
            "field": ["id"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "min": 150.0,
            "max": 250.0,
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(good_span_id, 16)}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for row in response.data["data"]:
            assert row["summary"] == {
                "min": 200.0,
                "max": 200.0,
                "sum": 200.0,
                "count": 1,
            }

        query = {
            "mri": "d:transactions/measurements.lcp@millisecond",
            "field": ["id", "span.duration"],
            "project": [self.project.id],
            "statsPeriod": "14d",
            "sort": "-span.duration",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
        expected = {int(span_id, 16) for span_id in span_ids}
        actual = {int(row["id"], 16) for row in response.data["data"]}
        assert actual == expected

        for duration, row in zip(reversed(durations), response.data["data"]):
            assert row["summary"] == {
                "min": duration,
                "max": duration,
                "sum": duration,
                "count": 1,
            }

    def test_custom_samples(self):
        mri = "d:custom/value@millisecond"
        values = [100, 200, 300]
        span_ids = [uuid4().hex[:16] for _ in values]
        good_span_id = span_ids[1]

        # 10 is below the min
        # 20 is within bounds
        # 30 is above the max
        for i, (span_id, val) in enumerate(zip(span_ids, values)):
            ts = before_now(days=i, minutes=10).replace(microsecond=0)
            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                duration=val,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                store_metrics_summary={
                    mri: [
                        {
                            "min": val - 1,
                            "max": val + 1,
                            "sum": val * (i + 1) * 2,
                            "count": (i + 1) * 2,
                            "tags": {},
                        }
                    ]
                },
            )

        self.store_indexed_span(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            timestamp=before_now(days=10, minutes=10).replace(microsecond=0),
            group=uuid4().hex[:16],  # we need a non 0 group
            store_metrics_summary={
                "d:custom/other@millisecond": [
                    {
                        "min": 210.0,
                        "max": 210.0,
                        "sum": 210.0,
                        "count": 1,
                        "tags": {},
                    }
                ]
            },
        )

        for operation, min_bound, max_bound in [
            ("avg", 150.0, 250.0),
            ("min", 150.0, 250.0),
            ("max", 150.0, 250.0),
            ("count", 3, 5),
        ]:
            query = {
                "mri": mri,
                "field": ["id"],
                "project": [self.project.id],
                "statsPeriod": "14d",
                "min": min_bound,
                "max": max_bound,
                "operation": operation,
            }
            response = self.do_request(query)
            assert response.status_code == 200, (operation, response.data)
            expected = {int(good_span_id, 16)}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected, operation

            for row in response.data["data"]:
                assert row["summary"] == {
                    "min": 199.0,
                    "max": 201.0,
                    "sum": 800.0,
                    "count": 4,
                }, operation

        for operation in ["avg", "min", "max", "count"]:
            query = {
                "mri": mri,
                "field": ["id", "span.duration"],
                "project": [self.project.id],
                "statsPeriod": "14d",
                "sort": "-summary",
                "operation": operation,
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(span_id, 16) for span_id in span_ids}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected

            for i, (val, row) in enumerate(zip(reversed(values), response.data["data"])):
                assert row["summary"] == {
                    "min": val - 1,
                    "max": val + 1,
                    "sum": val * (len(values) - i) * 2,
                    "count": (len(values) - i) * 2,
                }

    def test_multiple_span_sample_per_time_bucket(self):
        custom_mri = "d:custom/value@millisecond"
        values = [100, 200, 300, 400, 500]
        span_ids = [uuid4().hex[:16] for _ in values]
        ts = before_now(days=0, minutes=10).replace(microsecond=0)

        for span_id, value in zip(span_ids, values):
            self.store_indexed_span(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=span_id,
                duration=value,
                exclusive_time=value,
                timestamp=ts,
                group=uuid4().hex[:16],  # we need a non 0 group
                measurements={"score.total": value},
                store_metrics_summary={
                    custom_mri: [
                        {
                            "min": value - 1,
                            "max": value + 1,
                            "sum": value * 2,
                            "count": 2,
                            "tags": {},
                        }
                    ]
                },
            )

        for mri in [
            "d:spans/exclusive_time@millisecond",
            "d:spans/webvital.score.total@ratio",
            custom_mri,
        ]:
            query = {
                "mri": mri,
                "field": ["id"],
                "project": [self.project.id],
                "statsPeriod": "24h",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(span_ids[i], 16) for i in [0, 2, 4]}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected

    def test_multiple_transaction_sample_per_time_bucket(self):
        values = [100, 200, 300, 400, 500]
        span_ids = [uuid4().hex[:16] for _ in values]
        ts = before_now(days=0, minutes=10).replace(microsecond=0)

        for span_id, value in zip(span_ids, values):
            start_ts = ts - timedelta(microseconds=value * 1000)

            # first write to the transactions dataset
            data = load_data("transaction", start_timestamp=start_ts, timestamp=ts)
            # good span ids will have the measurement
            data["measurements"] = {"lcp": {"value": value}}
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
                duration=value,
                span_id=span_id,
                timestamp=ts,
            )

        for mri in [
            "d:transactions/duration@millisecond",
            "d:transactions/measurements.lcp@millisecond",
        ]:
            query = {
                "mri": mri,
                "field": ["id"],
                "project": [self.project.id],
                "statsPeriod": "24h",
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.data
            expected = {int(span_ids[i], 16) for i in [0, 2, 4]}
            actual = {int(row["id"], 16) for row in response.data["data"]}
            assert actual == expected
