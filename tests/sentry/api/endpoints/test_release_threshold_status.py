from datetime import datetime, timedelta

from django.urls import reverse

from sentry.models import Environment, Release, ReleaseEnvironment, ReleaseProjectEnvironment
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
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
        self.release1 = Release.objects.create(version="1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # release created for proj1
        self.release2 = Release.objects.create(version="2", organization=self.organization)
        self.release2.add_project(self.project1)

        # Not sure what Release Environments are for...
        # project superfluous/deprecated in ReleaseEnvironment
        # probably attaches the release to a particular environment?
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

        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-release-threshold-statuses",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_get_success(self):
        """
        Tests fetching all thresholds (env+project agnostic) within the past 24hrs.

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary # NOTE: is it possible to have a ReleaseProjectEnvironment without a corresponding ReleaseEnvironment??
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary
            - project1 canary
            - project1 prod
            - project2 canary

        so response should look like
        {
            [release1]: {
                [p1.id]: [threshold-p1-canary, threshold2-p1-canary, threshold-p1-prod]
                [p2.id]: [threshold-p2-canary]
            }
            [release2]: [
                [p1.id]: [threshold-p1-canary, threshold2-p1-canary, threshold-p1-prod]
            ]
        }
        """
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        last_week = str(datetime.now() - timedelta(days=7))
        release_old = Release.objects.create(
            version="0", organization=self.organization, date_added=last_week
        )

        response = self.get_success_response(self.organization.slug, start=yesterday, end=now)

        assert len(response.data) == 2  # 2 releases
        assert release_old.id not in response.data  # old release is filtered out of response
        assert len(response.data.get(self.release1.id)) == 2  # 2 projects (p1 & p2) in release 1

        assert (
            len(response.data.get(self.release1.id, {}).get(self.project1.id)) == 3
        )  # p1 2x canary, 1x prod
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[2]
            .get("environment", {})
            .get("name")
            == self.production_environment.name
        )  # assert environment is 'production'
        assert (
            len(response.data.get(self.release1.id, {}).get(self.project2.id)) == 1
        )  # p2 1x canary
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project2.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'

        assert len(response.data.get(self.release2.id)) == 1  # 1 project (p1) in release 2
        assert (
            len(response.data.get(self.release1.id, {}).get(self.project1.id)) == 3
        )  # p1 2x canary, 1x prod
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[2]
            .get("environment", {})
            .get("name")
            == self.production_environment.name
        )  # assert environment is 'production'

    def test_get_success_environment_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on environment

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary # NOTE: is it possible to have a ReleaseProjectEnvironment without a corresponding ReleaseEnvironment??
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary
            - project1 canary
            - project1 prod
            - project2 canary

        We'll filter for _only_ canary releases, so the response should look like
        {
            [release1]: {
                [p1.id]: [threshold-p1-canary, threshold2-p1-canary]
                [p2.id]: [threshold-p2-canary]
            }
        }
        """
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, environment=["canary"]
        )

        assert len(response.data) == 1  # only the canary release
        assert len(response.data.get(self.release1.id)) == 2  # 2 projects (p1 & p2) in release 1

        assert (
            len(response.data.get(self.release1.id, {}).get(self.project1.id)) == 2
        )  # p1 2x canary
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'
        assert (
            len(response.data.get(self.release1.id, {}).get(self.project2.id)) == 1
        )  # p2 1x canary
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project2.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'

        assert (
            len(response.data.get(self.release2.id, {})) == 0
        )  # release2 should not exist in the response

    def test_get_success_release_id_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on release_id's

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary # NOTE: is it possible to have a ReleaseProjectEnvironment without a corresponding ReleaseEnvironment??
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary
            - project1 canary
            - project1 prod
            - project2 canary

        We'll filter for _only_ release1, so the response should look like
        {
            [release1]: {
                [p1.id]: [threshold-p1-canary, threshold2-p1-canary, threshold-p1-prod]
                [p2.id]: [threshold-p2-canary]
            }
        }
        """
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, release_id=[self.release1.id]
        )

        assert len(response.data) == 1  # only fetched release1
        assert len(response.data.get(self.release1.id)) == 2  # 2 projects (p1 & p2) in release 1

        assert (
            len(response.data.get(self.release1.id, {}).get(self.project1.id)) == 3
        )  # p1 2x canary, 1x prod
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project1.id)[2]
            .get("environment", {})
            .get("name")
            == self.production_environment.name
        )  # assert environment is 'production'
        assert (
            len(response.data.get(self.release1.id, {}).get(self.project2.id)) == 1
        )  # p2 1x canary
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project2.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'

        assert (
            len(response.data.get(self.release2.id, {})) == 0
        )  # release2 should not exist in the response

    def test_get_success_project_id_filter(self):
        """
        Tests fetching thresholds within the past 24hrs filtered on project_id's
        NOTE: in order to determine *release* health, we still need all projects (& thresholds) associated with that release
        So - filtering on project will give us all the releases associated with that project
        but we still need all the other projects associated with the release to determine health status

        Set up creates
        - 2 releases
            - release1 - canary # env only matters for how we filter releases
                - r1-proj1-canary # NOTE: is it possible to have a ReleaseProjectEnvironment without a corresponding ReleaseEnvironment??
                - r1-proj2-canary
            - release2 - prod # env only matters for how we filter releases
                - r2-proj1-prod
        - 4 thresholds
            - project1 canary
            - project1 canary
            - project1 prod
            - project2 canary

        We'll filter for _only_ project2, so the response should look like
        since project2 was only ever added to release1
        {
            [release1]: { # NOTE: fetches only the releases that include p2
                [p1.id]: [threshold-p1-canary, threshold2-p1-canary, threshold-p1-prod]
                [p2.id]: [threshold-p2-canary]
            }
        }
        """
        now = str(datetime.now())
        yesterday = str(datetime.now() - timedelta(hours=24))
        response = self.get_success_response(
            self.organization.slug, start=yesterday, end=now, project=[self.project2.id]
        )

        assert len(response.data) == 1  # only fetched release1
        assert (
            len(response.data.get(self.release1.id)) == 1
        )  # p1 has been filtered out of the response

        assert (
            len(response.data.get(self.release1.id, {}).get(self.project2.id)) == 1
        )  # p2 1x canary
        assert (
            response.data.get(self.release1.id, {})
            .get(self.project2.id)[0]  # first threshold
            .get("environment", {})
            .get("name")
            == self.canary_environment.name
        )  # assert environment is 'canary'

        assert (
            len(response.data.get(self.release2.id, {})) == 0
        )  # release2 should not exist in the response
