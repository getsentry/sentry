from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.metadata.metrics_code_locations import (
    get_cache_key_for_code_location,
)
from sentry.sentry_metrics.querying.utils import get_redis_client_for_metrics_meta
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
@freeze_time("2023-11-21T10:30:30.000Z")
class OrganizationMetricsMetadataTest(APITestCase, BaseSpansTestCase):
    endpoint = "sentry-api-0-organization-metrics-metadata"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.redis_client = get_redis_client_for_metrics_meta()
        self.current_time = timezone.now()

    def _mock_code_location(
        self,
        filename: str,
        pre_context: list[str] | None = None,
        post_context: list[str] | None = None,
    ) -> str:
        code_location = {
            "function": "foo",
            "module": "bar",
            "filename": filename,
            "abs_path": f"/usr/src/foo/{filename}",
            "lineNo": 10,
            "context_line": "context",
        }

        if pre_context is not None:
            code_location["pre_context"] = pre_context
        if post_context is not None:
            code_location["post_context"] = post_context

        return json.dumps(code_location)

    def _store_code_location(
        self, organization_id: int, project_id: int, metric_mri: str, timestamp: int, value: str
    ):
        cache_key = get_cache_key_for_code_location(
            organization_id, project_id, metric_mri, timestamp
        )
        self.redis_client.sadd(cache_key, value)

    def _round_to_day(self, time: datetime) -> int:
        return int(time.timestamp() / 86400) * 86400

    def _store_code_locations(
        self,
        organization: Organization,
        projects: Sequence[Project],
        metric_mris: Sequence[str],
        days: int,
    ):
        timestamps = [
            self._round_to_day(self.current_time - timedelta(days=day)) for day in range(0, days)
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

    def test_get_locations_with_stats_period(self):
        projects = [self.create_project(name="project_1")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 2

        assert code_locations[0]["projectId"] == projects[0].id
        assert code_locations[0]["mri"] == mris[0]
        assert code_locations[0]["timestamp"] == self._round_to_day(
            self.current_time - timedelta(days=1)
        )

        assert code_locations[1]["projectId"] == projects[0].id
        assert code_locations[1]["mri"] == mris[0]
        assert code_locations[1]["timestamp"] == self._round_to_day(self.current_time)

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

    def test_get_locations_with_all_projects(self):
        projects = [
            self.create_project(organization=self.organization, name="project_1"),
            self.create_project(organization=self.organization, name="project_2"),
            self.create_project(organization=self.organization, name="project_3"),
        ]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project="-1",
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 6

    def test_get_locations_with_start_and_end(self):
        projects = [self.create_project(name="project_1")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            # We use an interval of 1 day but shifted by 1 day in the past.
            start=(self.current_time - timedelta(days=2)).isoformat(),
            end=(self.current_time - timedelta(days=1)).isoformat(),
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 1

        assert code_locations[0]["projectId"] == projects[0].id
        assert code_locations[0]["mri"] == mris[0]
        assert code_locations[0]["timestamp"] == self._round_to_day(
            self.current_time - timedelta(days=1)
        )

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

    def test_get_locations_with_start_and_end_and_no_data(self):
        projects = [self.create_project(name="project_1")]
        mris = ["d:custom/sentry.process_profile.track_outcome@second"]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            # We use an interval outside which we have no data.
            start=(self.current_time - timedelta(days=3)).isoformat(),
            end=(self.current_time - timedelta(days=2)).isoformat(),
            codeLocations="true",
        )
        codeLocations = response.data["codeLocations"]

        assert len(codeLocations) == 0

    @patch(
        "sentry.sentry_metrics.querying.metadata.metrics_code_locations.CodeLocationsFetcher._get_code_locations"
    )
    @patch(
        "sentry.sentry_metrics.querying.metadata.metrics_code_locations.CodeLocationsFetcher.BATCH_SIZE",
        10,
    )
    def test_get_locations_batching(self, get_code_locations_mock):
        get_code_locations_mock.return_value = []

        projects = [self.create_project(name="project_1")]
        mris = ["d:custom/sentry.process_profile.track_outcome@second"]

        self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="30d",
            codeLocations="true",
        )

        # With a window of 30 days, it means that we are actually requesting 31 days, thus we have 4 batches of 10
        # elements each.
        assert len(get_code_locations_mock.mock_calls) == 4

    def test_get_locations_with_incomplete_location(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            '{"lineno": 10}',
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 1

        assert code_locations[0]["mri"] == mri
        assert code_locations[0]["timestamp"] == self._round_to_day(self.current_time)

        frames = code_locations[0]["frames"]
        assert len(frames) == 1
        assert frames[0]["lineNo"] == 10
        # We check that all the remaining elements are `None` or empty.
        del frames[0]["lineNo"]
        for value in frames[0].values():
            assert value is None or value == []

    def test_get_locations_with_corrupted_location(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            '}"invalid": "json"{',
        )

        self.get_error_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            status_code=500,
            codeLocations="true",
        )

    def test_get_pre_post_context(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            self._mock_code_location("script.py", ["pre"], ["post"]),
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )

        code_locations = response.data["codeLocations"]

        frame = code_locations[0]["frames"][0]
        assert frame["preContext"] == ["pre"]
        assert frame["postContext"] == ["post"]

    def test_get_no_pre_post_context(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            self._mock_code_location("script.py"),
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )

        code_locations = response.data["codeLocations"]

        frame = code_locations[0]["frames"][0]
        assert frame["preContext"] == []
        assert frame["postContext"] == []

    @patch(
        "sentry.sentry_metrics.querying.metadata.metrics_code_locations.CodeLocationsFetcher.MAXIMUM_KEYS",
        50,
    )
    @patch(
        "sentry.sentry_metrics.querying.metadata.metrics_code_locations.CodeLocationsFetcher._in_batches"
    )
    def test_get_locations_with_too_many_combinations(self, _in_batches):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="90d",
            codeLocations="true",
        )

        args, *_ = _in_batches.call_args
        assert len(list(args[0])) == 46

    @patch(
        "sentry.sentry_metrics.querying.metadata.metrics_code_locations.CodeLocationsFetcher.MAX_SET_SIZE",
        1,
    )
    def test_get_locations_with_more_locations_than_limit(self):
        projects = [self.create_project(name="project_1")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        # We are storing two code locations with a limit of 1.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 2

        assert code_locations[0]["mri"] == mris[0]
        assert code_locations[0]["timestamp"] == self._round_to_day(
            self.current_time - timedelta(days=1)
        )

        assert code_locations[1]["mri"] == mris[0]
        assert code_locations[1]["timestamp"] == self._round_to_day(self.current_time)

        frames = code_locations[0]["frames"]
        assert len(frames) == 1

        frames = code_locations[0]["frames"]
        assert len(frames) == 1
