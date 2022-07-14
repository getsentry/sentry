from django.urls import reverse

from sentry.models import Release, ReleaseActivity
from sentry.testutils import APITestCase


class ReleaseActivityTest(APITestCase):
    ENDPOINT = "sentry-api-0-project-release-activity"

    def test_flag_off_404(self):
        url = reverse(
            "sentry-api-0-project-release-activity",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": "doesnt_matter",
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        not_found = self.client.get("/api/0/bad_endpoint")
        assert response.status_code == not_found.status_code == 404
        assert str(response.content) == str(not_found.content)

    def test_no_activity(self):
        with self.feature("organizations:active-release-monitor-alpha"):
            project = self.create_project(name="foo")
            release = Release.objects.create(organization_id=project.organization_id, version="1")
            release.add_project(project)

            url = reverse(
                "sentry-api-0-project-release-activity",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                    "version": release.version,
                },
            )

            self.login_as(user=self.user)
            response = self.client.get(url)
            assert response.status_code == 200
            assert response.data == []

    def test_simple(self):
        with self.feature("organizations:active-release-monitor-alpha"):
            project = self.create_project(name="foo")
            release = Release.objects.create(organization_id=project.organization_id, version="1")
            release.add_project(project)

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.started, data={}, release=release
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.new_issue, data={}, release=release
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivity.Type.finished, data={}, release=release
            )

            url = reverse(
                "sentry-api-0-project-release-activity",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                    "version": release.version,
                },
            )

            self.login_as(user=self.user)
            response = self.client.get(url)
            assert response.status_code == 200
            assert len(response.data) == 3
