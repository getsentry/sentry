from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.models import Environment
from sentry.models.deploy import Deploy
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupSuspectReleasesTest(APITestCase, SnubaTestCase):
    def test_no_suspect_releases(self):
        self.login_as(user=self.user)

        group = self.create_group()
        url = f"/api/0/issues/{group.id}/suspect-releases/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == []

        release = self.create_release(
            project=group.project,
            version="1.0",
            date_added=group.first_seen - timedelta(minutes=70),
        )
        environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.organization.id,
            release=release,
            date_finished=group.first_seen - timedelta(minutes=70),
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_with_suspect_release(self):
        self.login_as(user=self.user)

        group = self.create_group()
        release = self.create_release(
            project=group.project,
            version="1.0",
            date_added=group.first_seen - timedelta(minutes=30),
        )
        environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.organization.id,
            release=release,
            date_finished=group.first_seen - timedelta(minutes=30),
        )

        url = f"/api/0/issues/{group.id}/suspect-releases/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == [serialize(release)]

    def test_with_regression(self):
        self.login_as(user=self.user)

        group = self.create_group()
        release = self.create_release(
            project=group.project,
            version="1.0",
            date_added=group.first_seen - timedelta(minutes=30),
        )
        GroupHistory.objects.create(
            group=group,
            organization_id=self.organization.id,
            project_id=group.project_id,
            release=release,
            status=GroupHistoryStatus.REGRESSED,
        )

        url = f"/api/0/issues/{group.id}/suspect-releases/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == [serialize(release)]

    def test_multiple_suspect_releases(self):
        self.login_as(user=self.user)

        group = self.create_group()
        regression_release = self.create_release(
            project=group.project,
            version="1.0",
            date_added=group.first_seen - timedelta(minutes=40),
        )
        GroupHistory.objects.create(
            group=group,
            organization_id=self.organization.id,
            project_id=group.project_id,
            release=regression_release,
            status=GroupHistoryStatus.REGRESSED,
        )

        release = self.create_release(
            project=group.project,
            version="1.1",
            date_added=group.first_seen - timedelta(minutes=30),
        )
        environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.organization.id,
            release=release,
            date_finished=group.first_seen - timedelta(minutes=30),
        )

        url = f"/api/0/issues/{group.id}/suspect-releases/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == [
            serialize(release),
            serialize(regression_release),
        ]

    def test_duplicate_suspect_releases(self):
        self.login_as(user=self.user)

        group = self.create_group()
        release = self.create_release(
            project=group.project,
            version="1.0",
            date_added=group.first_seen - timedelta(minutes=40),
        )
        GroupHistory.objects.create(
            group=group,
            organization_id=self.organization.id,
            project_id=group.project_id,
            release=release,
            status=GroupHistoryStatus.REGRESSED,
        )
        environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.organization.id,
            release=release,
            date_finished=group.first_seen - timedelta(minutes=50),
        )

        url = f"/api/0/issues/{group.id}/suspect-releases/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == [serialize(release)]
