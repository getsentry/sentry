from sentry.models.environment import Environment
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.testutils.cases import APITestCase


class ReleaseThresholdTest(APITestCase):
    endpoint = "sentry-api-0-organization-release-thresholds"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True, is_superuser=True)
        self.login_as(user=self.user)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )
        self.production_environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )

    def test_get_invalid_project(self) -> None:
        self.get_error_response(self.organization.slug, project="foo bar")

    def test_get_no_project(self) -> None:
        self.get_error_response(self.organization.slug)

    def test_get_valid_project(self) -> None:
        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )
        response = self.get_success_response(self.organization.slug, project=self.project.id)
        assert len(response.data) == 1

        created_threshold = response.data[0]

        assert created_threshold["threshold_type"] == "total_error_count"
        assert created_threshold["trigger_type"] == "over"
        assert created_threshold["value"] == 100
        assert created_threshold["window_in_seconds"] == 1800
        assert created_threshold["project"]["id"] == str(self.project.id)
        assert created_threshold["project"]["slug"] == self.project.slug
        assert created_threshold["project"]["name"] == self.project.name
        assert created_threshold["environment"]["id"] == str(self.canary_environment.id)
        assert created_threshold["environment"]["name"] == self.canary_environment.name

    def test_get_invalid_environment(self) -> None:
        self.get_error_response(self.organization.slug, environment="foo bar", project="-1")

    def test_get_valid_no_environment(self) -> None:
        response = self.get_success_response(self.organization.slug, project="-1")
        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

        response = self.get_success_response(self.organization.slug, project=self.project.id)
        assert len(response.data) == 1

        created_threshold = response.data[0]

        assert created_threshold["threshold_type"] == "total_error_count"
        assert created_threshold["trigger_type"] == "over"
        assert created_threshold["value"] == 100
        assert created_threshold["window_in_seconds"] == 1800
        assert created_threshold["project"]["id"] == str(self.project.id)
        assert created_threshold["project"]["slug"] == self.project.slug
        assert created_threshold["project"]["name"] == self.project.name
        assert created_threshold["environment"]["id"] == str(self.canary_environment.id)
        assert created_threshold["environment"]["name"] == self.canary_environment.name

    def test_scoped_to_caller_accessible_projects(self) -> None:
        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_environment = Environment.objects.create(organization_id=other_org.id, name="canary")
        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=200,
            window_in_seconds=1800,
            project=other_project,
            environment=other_environment,
        )

        # Closed membership so a teamless member has access to zero projects;
        # otherwise `allow_joinleave` grants global project access and the
        # `projects_list == []` path that triggered the bug is unreachable.
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member", teams=[])
        self.login_as(user=member)

        response = self.get_success_response(self.organization.slug, project="-1")
        assert response.data == []

    def test_get_valid_with_environment(self) -> None:
        response = self.get_success_response(
            self.organization.slug, project="-1", environment="canary"
        )

        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=1,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.production_environment,
        )

        response = self.get_success_response(
            self.organization.slug, project="-1", environment="canary"
        )
        assert response.status_code == 200
        assert len(response.data) == 1

        created_threshold = response.data[0]

        assert created_threshold["threshold_type"] == "total_error_count"
        assert created_threshold["trigger_type"] == "over"
        assert created_threshold["value"] == 100
        assert created_threshold["window_in_seconds"] == 1800
        assert created_threshold["project"]["id"] == str(self.project.id)
        assert created_threshold["project"]["slug"] == self.project.slug
        assert created_threshold["project"]["name"] == self.project.name
        assert created_threshold["environment"]["id"] == str(self.canary_environment.id)
        assert created_threshold["environment"]["name"] == self.canary_environment.name
