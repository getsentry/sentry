from datetime import timedelta
from unittest import mock

from sentry.api.endpoints.release_thresholds.health_checks.is_new_issues_count_healthy import (
    is_new_issues_count_healthy,
)
from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import TestCase


class TestGetNewIssueCountIsHealthy(TestCase):
    def setUp(self):
        super().setUp()

        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.project2 = self.create_project(name="bar", organization=self.organization)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )
        self.production_environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )

        # release created for proj1, and proj2
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # release created for proj1
        self.release2 = Release.objects.create(version="v2", organization=self.organization)
        self.release2.add_project(self.project1)

        # Attaches the release to a particular environment
        # project superfluous/deprecated in ReleaseEnvironment
        # release1 canary
        ReleaseEnvironment.objects.create(
            organization_id=self.organization.id,
            release_id=self.release1.id,
            environment_id=self.canary_environment.id,
        )
        # Release Project Environments are required to query releases by project
        # Even though both environment & project are here, this seems to just attach a release to a project
        # You can have multiple ReleaseProjectEnvironment's per release (this attaches multiple projects to the release&env)
        # release1 project1 canary
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project1.id,
            environment_id=self.canary_environment.id,
        )
        # release1 project2 canary
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project2.id,
            environment_id=self.canary_environment.id,
        )

        # release2 prod
        ReleaseEnvironment.objects.create(
            organization_id=self.organization.id,
            release_id=self.release2.id,
            environment_id=self.production_environment.id,
        )
        # release2 project1 prod
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release2.id,
            project_id=self.project1.id,
            environment_id=self.production_environment.id,
        )

        self.new_issue_count_release_threshold = ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.NEW_ISSUE_COUNT,
            trigger_type=1,
            value=2,
            window_in_seconds=100,
            project=self.project1,
            environment=self.canary_environment,
        )
        self.new_issue_count_release_threshold_without_env = ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.NEW_ISSUE_COUNT,
            trigger_type=1,
            value=1,
            window_in_seconds=100,
            project=self.project2,
        )
        self._create_new_issues_for_release_threshold()

    def _create_new_issues_for_release_threshold(self) -> None:
        self.new_issue_time = self.new_issue_count_release_threshold.date_added + timedelta(
            seconds=10
        )
        for _ in range(2):
            grouped_issue = Group.objects.create(
                project=self.project1,
            )
            GroupEnvironment.objects.create(
                group=grouped_issue,
                environment=self.canary_environment,
                first_release=self.release1,
                first_seen=self.new_issue_time,
            )

            Group.objects.create(
                project=self.project2, first_release=self.release1, first_seen=self.new_issue_time
            )

    def test_returns_true_when_is_healthy(self) -> None:
        enriched_threshold = serialize(self.new_issue_count_release_threshold)
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        enriched_threshold.update(
            {
                "start": start_time,
                "end": end_time,
                "project_id": self.project1.id,
                "release_id": self.release1.id,
            }
        )

        is_healthy = is_new_issues_count_healthy(enriched_threshold)
        assert is_healthy is True

    def test_returns_false_when_is_not_healthy(self) -> None:
        enriched_threshold = serialize(self.new_issue_count_release_threshold)
        # Get a time range when no issues are there
        start_time = self.new_issue_time + timedelta(hours=1)
        end_time = self.new_issue_time + timedelta(hours=2)
        enriched_threshold.update(
            {
                "start": start_time,
                "end": end_time,
                "project_id": self.project1.id,
                "release_id": self.release1.id,
            }
        )

        is_healthy = is_new_issues_count_healthy(enriched_threshold)
        assert is_healthy is False

    def test_returns_false_when_no_issues_exist(self) -> None:
        enriched_threshold = serialize(self.new_issue_count_release_threshold)
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        enriched_threshold.update(
            {
                "start": start_time,
                "end": end_time,
                "project_id": self.project1.id,
                "release_id": self.release2.id,
            }
        )

        is_healthy = is_new_issues_count_healthy(enriched_threshold)
        assert is_healthy is False

    def test_when_release_threshold_does_not_have_env(self) -> None:
        enriched_threshold = serialize(self.new_issue_count_release_threshold_without_env)
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        enriched_threshold.update(
            {
                "start": start_time,
                "end": end_time,
                "project_id": self.project2.id,
                "release_id": self.release1.id,
            }
        )

        is_healthy = is_new_issues_count_healthy(enriched_threshold)
        assert is_healthy is True

    @mock.patch(
        "sentry.api.endpoints.release_thresholds.health_checks.is_new_issues_count_healthy.logger"
    )
    def test_returns_false_when_error_in_query(self, logger) -> None:
        enriched_threshold = serialize(self.new_issue_count_release_threshold)
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        enriched_threshold.update(
            {
                "start": start_time,
                "end": end_time,
                "project_id": self.project1.id,
                "release_id": self.release1.id,
            }
        )
        del enriched_threshold["environment"]["id"]
        is_healthy = is_new_issues_count_healthy(enriched_threshold)
        assert is_healthy is False
        assert logger.exception.call_count == 1
