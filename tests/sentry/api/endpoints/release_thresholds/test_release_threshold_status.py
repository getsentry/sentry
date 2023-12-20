from datetime import datetime, timedelta

from sentry.api.endpoints.release_thresholds.release_threshold_status_index import (
    EnrichedThreshold,
    is_error_count_healthy,
)
from sentry.api.serializers import serialize
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import APITestCase, TestCase


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
            threshold_type=ReleaseThresholdType.NEW_ISSUE_COUNT,
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
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        last_week = str(datetime.now() - timedelta(days=7))
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
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
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
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))

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
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
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
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, project=[self.project2.slug]
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


class ErrorCountThresholdCheckTest(TestCase):
    def setUp(self):
        # 3 projects
        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.project2 = self.create_project(name="bar", organization=self.organization)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )

        # release created for proj1, and proj2
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # release created for proj1
        self.release2 = Release.objects.create(version="v2", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release2.add_project(self.project1)

    def test_threshold_within_timeseries(self):
        """
        construct a timeseries with:
        - a single release
        - a single project
        - no environment
        - multiple timestamps both before and after our threshold window
        """
        now = datetime.utcnow()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
        ]

        # current threshold within series
        current_threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,  # error counts _not_ be over threshold value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=current_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold equal to count
        threshold_at_limit_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,  # error counts equal to threshold limit value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_at_limit_healthy, timeseries=timeseries
        )
        assert is_healthy

        # past healthy threshold within series
        past_threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=2),
            "end": now - timedelta(minutes=1),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=past_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but trigger is under
        threshold_under_unhealthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_under_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

        # threshold within series but end is in future
        threshold_unfinished: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now + timedelta(minutes=5),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unfinished, timeseries=timeseries
        )
        assert is_healthy

    def test_multiple_releases_within_timeseries(self):
        now = datetime.utcnow()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release2.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 2,
            },
        ]

        # base threshold within series
        threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy release
        threshold_unhealthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release2.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_multiple_projects_within_timeseries(self):
        now = datetime.utcnow()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project2.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 2,
            },
        ]

        # base threshold within series
        # unhealthy means error count OVER 4 over 1m window
        threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy project
        threshold_unhealthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project2),
            "project_id": self.project2.id,
            "project_slug": self.project2.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_multiple_environments_within_timeseries(self):
        now = datetime.utcnow()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": "canary",
                "count()": 2,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": "canary",
                "count()": 2,
            },
        ]

        # base threshold within series
        threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but separate unhealthy environment
        threshold_unhealthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": serialize(self.canary_environment),
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

    def test_unordered_timeseries(self):
        """
        construct a timeseries with:
        - a single release
        - a single project
        - no environment
        - multiple timestamps both before and after our threshold window
        - all disorganized
        """
        now = datetime.utcnow()
        timeseries = [
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=3)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": now.isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=1)).isoformat(),
                "environment": None,
                "count()": 1,
            },
            {
                "release": self.release1.version,
                "project_id": self.project1.id,
                "time": (now - timedelta(minutes=2)).isoformat(),
                "environment": None,
                "count()": 1,
            },
        ]

        # current threshold within series
        current_threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,  # error counts _not_ be over threshold value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=current_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold equal to count
        threshold_at_limit_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 1,  # error counts equal to threshold limit value
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_at_limit_healthy, timeseries=timeseries
        )
        assert is_healthy

        # past healthy threshold within series
        past_threshold_healthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=2),
            "end": now - timedelta(minutes=1),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 2,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=past_threshold_healthy, timeseries=timeseries
        )
        assert is_healthy

        # threshold within series but trigger is under
        threshold_under_unhealthy: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now,
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.UNDER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_under_unhealthy, timeseries=timeseries
        )
        assert not is_healthy

        # threshold within series but end is in future
        threshold_unfinished: EnrichedThreshold = {
            "date": now,
            "start": now - timedelta(minutes=1),
            "end": now + timedelta(minutes=5),
            "environment": None,
            "is_healthy": False,
            "key": "",
            "project": serialize(self.project1),
            "project_id": self.project1.id,
            "project_slug": self.project1.slug,
            "release": self.release1.version,
            "threshold_type": ReleaseThresholdType.TOTAL_ERROR_COUNT,
            "trigger_type": TriggerType.OVER_STR,
            "value": 4,
            "window_in_seconds": 60,  # NOTE: window_in_seconds only used to determine start/end. Not utilized in validation method
            "metric_value": None,
        }
        is_healthy, metric_count = is_error_count_healthy(
            ethreshold=threshold_unfinished, timeseries=timeseries
        )
        assert is_healthy
