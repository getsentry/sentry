from typing import Dict

from django.urls import reverse

from sentry.models.debugfile import ProguardArtifactRelease, ProjectDebugFile
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProguardArtifactReleasesEndpointTest(APITestCase):
    def test_create_proguard_artifact_release_successfully(self):
        project = self.create_project(name="foo")

        proguard_uuid = "660f839b-8bfd-580d-9a7c-ea339a6c9867"

        url = reverse(
            "sentry-api-0-proguard-artifact-releases",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )

        data = {
            "release_name": "test@1.0.0",
            "proguard_uuid": proguard_uuid,
        }

        file = File.objects.create(
            name="proguard.txt", type="default", headers={"Content-Type": "text/plain"}
        )

        ProjectDebugFile.objects.create(
            file=file,
            object_name="proguard.txt",
            cpu_name="x86",
            project_id=project.id,
            debug_id=proguard_uuid,
        )

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

        data_missing_uuid = {
            "release_name": "test@1.0.0",
        }
        data_missing_release_name = {
            "proguard_uuid": "660f839b-8bfd-580d-9a7c-ea339a6c9867",
        }
        data_missing_all: Dict[str, str] = {}

        self.login_as(user=self.user)

        response = self.client.post(url, data=data_missing_uuid, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"error": "Missing required fields: proguard_uuid"}

        response = self.client.post(url, data=data_missing_release_name, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"error": "Missing required fields: release_name"}

        response = self.client.post(url, data=data_missing_all, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {"error": "Missing required fields: release_name, proguard_uuid"}

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

        file = File.objects.create(
            name="proguard.txt", type="default", headers={"Content-Type": "text/plain"}
        )

        project_debug_file = ProjectDebugFile.objects.create(
            file=file,
            object_name="proguard.txt",
            cpu_name="x86",
            project_id=project.id,
            debug_id="660f839b-8bfd-580d-9a7c-ea339a6c9867",
        )

        ProguardArtifactRelease.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release_name=data["release_name"],
            proguard_uuid=data["proguard_uuid"],
            project_debug_file=project_debug_file,
        )

        self.login_as(user=self.user)
        response = self.client.post(url, data=data)

        assert response.status_code == 409, response.content
        assert response.data == {
            "error": "Proguard artifact release with this name in this project already exists."
        }

    def test_list_proguard_artifact_releases_with_uuid_successfully(self):
        project = self.create_project(name="foo")
        proguard_uuid = "660f839b-8bfd-580d-9a7c-ea339a6c9867"

        file = File.objects.create(
            name="proguard.txt", type="default", headers={"Content-Type": "text/plain"}
        )

        project_debug_file = ProjectDebugFile.objects.create(
            file=file,
            object_name="proguard.txt",
            cpu_name="x86",
            project_id=project.id,
            debug_id=proguard_uuid,
        )

        ProguardArtifactRelease.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release_name="test@1.0.0",
            proguard_uuid=proguard_uuid,
            project_debug_file=project_debug_file,
        )

        url = reverse(
            "sentry-api-0-proguard-artifact-releases",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url, {"proguard_uuid": proguard_uuid})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert list(response.data["releases"]) == ["test@1.0.0"]

    def test_create_proguard_artifact_release_with_non_existent_uuid(self):
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
            "proguard_uuid": "660f839b-8bfd-580d-9a7c-ea339a6ccccc",
        }

        file = File.objects.create(
            name="proguard.txt", type="default", headers={"Content-Type": "text/plain"}
        )

        ProjectDebugFile.objects.create(
            file=file,
            object_name="proguard.txt",
            cpu_name="x86",
            project_id=project.id,
            debug_id="660f839b-8bfd-580d-9a7c-ea339a6cbbbb",
        )

        self.login_as(user=self.user)
        response = self.client.post(url, data=data)

        assert response.status_code == 400, response.content
        assert response.data == {"error": "No matching proguard mapping file with this uuid found"}

    def test_create_proguard_artifact_release_with_invalid_uuid(self):
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
            "proguard_uuid": "invalid-uuid",
        }

        file = File.objects.create(
            name="proguard.txt", type="default", headers={"Content-Type": "text/plain"}
        )

        ProjectDebugFile.objects.create(
            file=file,
            object_name="proguard.txt",
            cpu_name="x86",
            project_id=project.id,
            debug_id="660f839b-8bfd-580d-9a7c-ea339a6cbbbb",
        )

        self.login_as(user=self.user)
        response = self.client.post(url, data=data)

        assert response.status_code == 400, response.content
        assert response.data == {"error": "Invalid proguard_uuid"}
