import copy
import uuid
from functools import partial

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
        self.store_segment(
            project_id=self.project.id,
            timestamp=before_now(minutes=10),
            trace_id=uuid.uuid4().hex,
            transaction_id=uuid.uuid4().hex,
        )

        query = {
            "mri": "d:spans/duration@millisecond",
            "field": ["id", "span.self_time"],
            "project": [self.project.id],
            "statsPeriod": "14d",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.data
