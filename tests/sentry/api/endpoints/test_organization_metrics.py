import copy

import pytest
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    SessionMRI,
    SingularEntityDerivedMetric,
    complement,
    division_float,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
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
                division_float(crashed_count, errored_set, alias=alias),
                alias="crash_free_fake",
            ),
        )
    }
)


class OrganizationMetricsPermissionTest(APITestCase):
    endpoints = [
        ["get", "sentry-api-0-organization-metrics-details"],
        [
            "get",
            "sentry-api-0-organization-metrics-tags",
        ],
        [
            "get",
            "sentry-api-0-organization-metrics-data",
        ],
        [
            "post",
            "sentry-api-0-organization-metrics-query",
        ],
    ]

    def setUp(self):
        self.create_project(name="Bar", slug="bar", teams=[self.team], fire_project_created=True)

    def send_request(self, organization, token, method, endpoint, *args):
        url = reverse(endpoint, args=(organization.slug,) + args)
        return getattr(self.client, method)(
            url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json"
        )

    def test_access_with_wrong_permission_scopes(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        for method, endpoint, *rest in self.endpoints:
            response = self.send_request(self.organization, token, method, endpoint, *rest)
            assert response.status_code == 403

    def test_access_of_another_organization(self):
        other_user = self.create_user("admin_2@localhost", is_superuser=True, is_staff=True)
        self.create_organization(name="foo", slug="foo", owner=other_user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=other_user, scope_list=["org:read"])

        for method, endpoint, *rest in self.endpoints:
            response = self.send_request(self.organization, token, method, endpoint, *rest)
            assert response.status_code == 403

    def test_access_with_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for method, endpoint, *rest in self.endpoints:
            response = self.send_request(self.organization, token, method, endpoint, *rest)
            assert response.status_code in (200, 400, 404)
