from django.urls import reverse

from sentry.models.debugfile import ProguardArtifactRelease
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ProguardArtifactReleasesEndpointTest(APITestCase):
    def test_create_proguard_artifact_release_successfully(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-proguard-artifact-releases",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )

        data = {
            "release_name": "test@1.0.0",
            "proguard_uuid": "660f839b-8bfd-580d-9a7c-ea339a6c9867",
        }
        self.login_as(user=self.user)
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert ProguardArtifactRelease.objects.count() == 1

        proguard_artifact_release = ProguardArtifactRelease.objects.first()
        assert proguard_artifact_release.organization_id == project.organization.id
        assert proguard_artifact_release.project_id == project.id

    def test_create_proguard_artifact_release_with_missing_fields(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-proguard-artifact-releases",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )

        data = {
            "release_name": "test@1.0.0",
        }
        self.login_as(user=self.user)
        response = self.client.post(url, data=data, format="json")

        assert response.status_code == 400, response.content
        assert response.data == {"error": "Missing required fields"}

    def test_create_proguard_artifact_release_with_conflicting_release_name(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-proguard-artifact-releases",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )

        data = {
            "release_name": "test@1.0.0",
            "proguard_uuid": "660f839b-8bfd-580d-9a7c-ea339a6c9867",
        }

        ProguardArtifactRelease.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release_name=data["release_name"],
            proguard_uuid=data["proguard_uuid"],
        )

        self.login_as(user=self.user)
        response = self.client.post(url, data=data)

        assert response.status_code == 409, response.content
        assert response.data == {
            "error": "Proguard artifact release with this name in this project already exists."
        }
