from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import APITestCase


class ReleaseThresholdStatusTest(APITestCase):
    endpoint = "sentry-api-0-organization-release-threshold-statuses"
    method = "get"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_staff=True, is_superuser=True)
        # 3 projects
        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.project2 = self.create_project(name="bar", organization=self.organization)
        self.project3 = self.create_project(name="biz", organization=self.organization)

        # 2 environments
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

        # release created for proj3
        self.release3 = Release.objects.create(version="v3", organization=self.organization)
        self.release3.add_project(self.project3)

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

        # thresholds for project1 in canary
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=1,
            value=100,
            window_in_seconds=100,
            project=self.project1,
            environment=self.canary_environment,
        )
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=1,
            value=100,
            window_in_seconds=100,
            project=self.project1,
            environment=self.canary_environment,
        )
        # threshold for project1 in production
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=1,
            value=100,
            window_in_seconds=100,
            project=self.project1,
            environment=self.production_environment,
        )
        # threshold for project2 in canary
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=1,
            value=100,
            window_in_seconds=100,
            project=self.project2,
            environment=self.canary_environment,
        )
        # threshold for project3 with no environment
        # NOTE: project 3 is also the only project for which a release was created with NO environment
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=1,
            value=100,
            window_in_seconds=100,
            project=self.project3,
        )

        self.login_as(user=self.user)

    def test_get_success(self):
        """
        Tests fetching all thresholds (env+project agnostic) within the past 24hrs.

        Set up creates
        - 3 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary # NOTE: is it possible to have a ReleaseProjectEnvironment without a corresponding ReleaseEnvironment??
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
            - release3 - None
        - 4 thresholds
            - project1 canary error_counts
            - project1 canary new_issues
            - project1 prod error_counts
            - project2 canary error_counts
            - project3 no environment error_counts

        so response should look like
        {
            {p1.slug}-{release1.version}: [threshold, threshold1, threshold2]
            {p1.slug}-{release2.version}: [threshold, threshold, threshold]
            {p1.slug}-{release3.version}: [threshold]
            {p2.slug}-{release1.version}: [threshold]
        }
        """
        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)
        last_week = datetime.now(UTC) - timedelta(days=7)
        release_old = Release.objects.create(
            version="old_version", organization=self.organization, date_added=last_week
        )

        response = self.get_success_response(self.organization.slug, start=yesterday, end=now)

        assert len(response.data.keys()) == 4
        for key in response.data.keys():
            # NOTE: special characters *can* be included in release versions or environment names
            assert release_old.version not in key  # old release is filtered out of response
        data = response.data
        # release1
        r1_keys = [k for k, v in data.items() if k.split("-")[1] == self.release1.version]
        assert len(r1_keys) == 2  # 2 keys produced in release 1 (p1, p2)

        temp_key = f"{self.project1.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 3
        temp_key = f"{self.project2.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 1

        # release2
        r2_keys = [k for k, v in data.items() if k.split("-")[1] == self.release2.version]
        assert len(r2_keys) == 1  # 1 key produced in release 2 (p1)
        temp_key = f"{self.project1.slug}-{self.release2.version}"
        assert temp_key in r2_keys
        assert len(data[temp_key]) == 3

        # release3
        r3_keys = [k for k, v in data.items() if k.split("-")[1] == self.release3.version]
        assert len(r3_keys) == 1  # 1 key produced in release 3 (p1)
        temp_key = f"{self.project3.slug}-{self.release3.version}"
        assert temp_key in r3_keys
        assert len(data[temp_key]) == 1

    def test_get_success_environment_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on environment

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary error_counts
            - project1 canary new_issues
            - project1 prod error_counts
            - project2 canary error_counts

        We'll filter for _only_ canary releases, so the response should look like
        {
            {p1.slug}-{release1.version}: [threshold1, threshold2]
            {p2.slug}-{release1.version}: [threshold]
        }
        """
        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, environment=["canary"]
        )

        assert len(response.data.keys()) == 2
        data = response.data
        # release1
        r1_keys = [k for k, v in data.items() if k.split("-")[1] == self.release1.version]
        assert len(r1_keys) == 2  # 2 keys produced in release 1 (p1-canary, p2-canary)

        temp_key = f"{self.project1.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 2
        assert data[temp_key][0].get("environment", {}).get("name") == "canary"

        temp_key = f"{self.project2.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 1
        assert data[temp_key][0].get("environment", {}).get("name") == "canary"

    def test_get_success_environment_with_deploy(self):
        """
        Tests fetching thresholds within the past 24hrs for a release+env with a related deploys
        API should utilize deploy finished_at, rather than release created_at timestamp

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary error_counts
            - project1 canary new_issues
            - project1 prod error_counts
            - project2 canary error_counts
        - 1 deploy
            - r1 + canary
        - 1 ReleaseProjectEnvironment
            - deploy + r1 + p1 + canary

        We'll filter for _only_ canary releases, so the response should look like
        {
            {p1.slug}-{release1.version}: [threshold1, threshold2]
            {p2.slug}-{release1.version}: [threshold]
        }
        """
        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)

        # Creates a deploy for a particular Release in a particular Environment
        r1_canary_deploy = Deploy.objects.create(
            environment_id=self.canary_environment.id,
            organization_id=self.organization.id,
            release=self.release1,
            date_finished=now,
        )
        rpe = ReleaseProjectEnvironment.objects.get(
            release_id=self.release1.id,
            project_id=self.project1.id,
            environment_id=self.canary_environment.id,
        )
        rpe.update(
            last_deploy_id=r1_canary_deploy.id,
        )

        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, environment=["canary"]
        )

        assert len(response.data.keys()) == 2
        data = response.data
        # release1
        r1_keys = [k for k, v in data.items() if k.split("-")[1] == self.release1.version]
        assert len(r1_keys) == 2  # 2 keys produced in release 1 (p1-canary, p2-canary)

        temp_key = f"{self.project1.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 2
        assert data[temp_key][0].get("environment", {}).get("name") == "canary"

        temp_key = f"{self.project2.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 1
        assert data[temp_key][0].get("environment", {}).get("name") == "canary"

    def test_get_success_release_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on release versions

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary error_counts
            - project1 canary new_issues
            - project1 prod error_counts
            - project2 canary error_counts

        We'll filter for _only_ release1, so the response should look like
        {
            {p1.slug}-{release1.version}: [threshold1, threshold2, threshold]
            {p2.slug}-{release1.version}: [threshold]
        }
        """
        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, release=[self.release1.version]
        )

        assert len(response.data.keys()) == 2
        data = response.data
        # release1
        r1_keys = [k for k, v in data.items() if k.split("-")[1] == self.release1.version]
        assert len(r1_keys) == 2  # 2 keys produced in release 1 (p1, p2)

        temp_key = f"{self.project1.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 3
        temp_key = f"{self.project2.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 1

        # release2
        r2_keys = [k for k, v in data.items() if k.split("-")[1] == self.release2.version]
        assert len(r2_keys) == 0

    def test_get_success_project_slug_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on project_slug's
        NOTE: Because releases may have multiple projects, filtering by project is _not_ adequate to
        return accurate release health
        So - filtering on project will give us all the releases associated with that project
        but we still need all the other projects associated with the release to determine health status

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary error_counts
            - project1 canary new_issues
            - project1 prod error_counts
            - project2 canary error_counts


        We'll filter for _only_ project2, so the response should look like
        since project2 was only ever added to release1
        {
            {p2.slug}-{release1.version}: [threshold]
        }
        """
        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, projectSlug=[self.project2.slug]
        )

        assert len(response.data.keys()) == 1
        data = response.data
        # release1
        r1_keys = [k for k, v in data.items() if k.split("-")[1] == self.release1.version]
        assert len(r1_keys) == 1  # 1 key produced in release 1 (p2-canary)

        temp_key = f"{self.project1.slug}-{self.release1.version}"
        assert temp_key not in r1_keys
        temp_key = f"{self.project2.slug}-{self.release1.version}"
        assert temp_key in r1_keys
        assert len(data[temp_key]) == 1
        temp_key = (
            f"{self.project1.slug}-{self.production_environment.name}-{self.release1.version}"
        )
        assert temp_key not in r1_keys

        # release2
        r2_keys = [k for k, v in data.items() if k.split("-")[1] == self.release2.version]
        assert len(r2_keys) == 0

    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.fetch_sessions_data"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.is_crash_free_rate_healthy_check"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.get_errors_counts_timeseries_by_project_and_release"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.is_error_count_healthy"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.get_new_issue_counts"
    )
    @patch(
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.is_new_issue_count_healthy"
    )
    def test_fetches_relevant_stats(
        self,
        mock_is_new_issue_count_healthy,
        mock_get_new_issue_counts,
        mock_is_error_count_healthy,
        mock_get_error_counts,
        mock_is_crash_free_rate_healthy,
        mock_fetch_sessions_data,
    ):
        self.project4 = self.create_project(name="baz", organization=self.organization)
        self.release4 = Release.objects.create(version="v4", organization=self.organization)
        self.release4.add_project(self.project4)
        # Threshold for error count
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.TOTAL_ERROR_COUNT,
            trigger_type=0,  # over
            value=100,
            window_in_seconds=100,
            project=self.project4,
        )
        # Threshold for new issue count
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.NEW_ISSUE_COUNT,
            trigger_type=0,  # over
            value=10,
            window_in_seconds=100,
            project=self.project4,
        )
        # Threshold for crash free rate
        ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
            trigger_type=1,  # under
            value=99,
            window_in_seconds=3600,
            project=self.project4,
        )

        now = datetime.now(UTC)
        yesterday = datetime.now(UTC) - timedelta(hours=24)

        mock_is_error_count_healthy.return_value = True, 100
        mock_is_new_issue_count_healthy.return_value = True, 100
        mock_is_crash_free_rate_healthy.return_value = True, 100

        self.get_success_response(
            self.organization.slug,
            start=yesterday,
            end=now,
            release=[self.release4.version],
        )

        assert mock_get_error_counts.call_count == 1
        assert mock_is_error_count_healthy.call_count == 1
        assert mock_get_new_issue_counts.call_count == 1
        assert mock_is_new_issue_count_healthy.call_count == 1
        assert mock_fetch_sessions_data.call_count == 1
        assert mock_is_crash_free_rate_healthy.call_count == 1
