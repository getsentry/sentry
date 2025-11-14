from typing import int
import copy

import pytest
from django.http import HttpResponse
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
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
    (method, endpoint) = ("get", "sentry-api-0-organization-metrics-data")

    def setUp(self) -> None:
        self.create_project(name="Bar", slug="bar", teams=[self.team], fire_project_created=True)

    def send_request(
        self, organization: Organization, token: ApiToken, method: str, endpoint: str, *args: str
    ) -> HttpResponse:
        url = reverse(endpoint, args=(organization.slug,) + args)
        return getattr(self.client, method)(
            url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json"
        )

    def test_access_with_wrong_permission_scopes(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["alerts:read"])

        response = self.send_request(self.organization, token, self.method, self.endpoint)
        assert response.status_code == 403

    def test_access_of_another_organization(self) -> None:
        other_user = self.create_user("admin_2@localhost", is_superuser=True, is_staff=True)
        self.create_organization(name="foo", slug="foo", owner=other_user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=other_user, scope_list=["org:read"])

        response = self.send_request(self.organization, token, self.method, self.endpoint)
        assert response.status_code == 403

    def test_access_with_permissions(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        response = self.send_request(self.organization, token, self.method, self.endpoint)
        assert response.status_code in (200, 400, 404)
