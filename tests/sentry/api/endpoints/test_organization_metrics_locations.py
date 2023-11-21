from datetime import timedelta
from typing import Sequence

import pytest
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.metadata import get_cache_key_for_code_location
from sentry.sentry_metrics.querying.utils import get_redis_client_for_ingest
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics


@freeze_time("2023-11-21T10:30:30.000Z")
@region_silo_test(stable=True)
class OrganizationMetricsLocationsTest(MetricsAPIBaseTestCase):

    endpoint = "sentry-api-0-organization-metrics-locations"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.redis_client = get_redis_client_for_ingest()
        self.current_time = timezone.now()

    def _mock_code_location(self, filename) -> str:
        code_location = {
            "function": "foo",
            "module": "bar",
            "filename": filename,
            "abs_path": f"/usr/src/foo/{filename}",
            "lineno": 10,
        }

        return json.dumps(code_location)

    def _store_code_location(
        self, organization_id: int, project_id: int, metric_mri: str, timestamp: int, value: str
    ):
        cache_key = get_cache_key_for_code_location(
            organization_id, project_id, metric_mri, timestamp
        )
        self.redis_client.sadd(cache_key, value)

    def _store_code_locations(
        self,
        organization: Organization,
        projects: Sequence[Project],
        metric_mris: Sequence[str],
        days: int,
    ):
        timestamps = [
            int((self.current_time - timedelta(days=day)).timestamp() / 86400) * 86400
            for day in range(0, days + 1)
        ]
        for project in projects:
            for metric_mri in metric_mris:
                for timestamp in timestamps:
                    self._store_code_location(
                        organization.id,
                        project.id,
                        metric_mri,
                        timestamp,
                        self._mock_code_location("script.py"),
                    )
                    self._store_code_location(
                        organization.id,
                        project.id,
                        metric_mri,
                        timestamp,
                        self._mock_code_location("main.py"),
                    )

    def test_get_locations_simple(self):
        projects = [self.create_project(name="project_1")]
        # self.create_project(name="project_2")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
            # "d:custom/sentry.test.track_outcome@second",
        ]

        self._store_code_locations(self.organization, projects, mris, 1)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="1d",
        )
        assert response.data == [
            {"key": "tag1", "value": "value1"},
            {"key": "tag1", "value": "value2"},
        ]
