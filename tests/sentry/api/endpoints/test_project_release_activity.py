from datetime import timedelta

from django.utils import timezone

from sentry.models import Release, ReleaseActivity
from sentry.testutils import APITestCase


class ReleaseActivityTest(APITestCase):
    endpoint = "sentry-api-0-project-release-activity"

    def test_flag_off_404(self):
        self.login_as(user=self.user)

        response = self.get_response(
            self.project.organization.slug, self.project.slug, "doesnt_matter"
        )
        not_found = self.client.get("/api/0/bad_endpoint")
        assert response.status_code == not_found.status_code == 404
        assert str(response.content) == str(not_found.content)

    def test_simple(self):
        with self.feature("organizations:active-release-monitor-alpha"):
            now = timezone.now()

            project = self.create_project(name="foo")
            release = Release.objects.create(
                organization_id=project.organization_id,
                version="1",
                date_added=now - timedelta(hours=5),
            )
            release.add_project(project)

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.deployed,
                release=release,
                date_added=now - timedelta(hours=1, minutes=1),
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.issue,
                data={"issue_id": self.group.id},
                release=release,
                date_added=now - timedelta(minutes=33),
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.finished,
                release=release,
                date_added=now - timedelta(minutes=1),
            )

            self.login_as(user=self.user)
            response = self.get_response(project.organization.slug, project.slug, release.version)
            assert response.status_code == 200
            assert len(response.data) == 4
            assert response.data[0]["type"] == ReleaseActivity.Type.finished
            assert response.data[1]["type"] == ReleaseActivity.Type.issue
            assert response.data[1]["data"]["issue_id"] == self.group.id
            assert response.data[2]["type"] == ReleaseActivity.Type.deployed
            assert response.data[3]["type"] == ReleaseActivity.Type.created
