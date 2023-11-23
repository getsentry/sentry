import base64
import io
import zipfile
from uuid import uuid4

from django.urls import reverse

from sentry.models.artifactbundle import ArtifactBundle, ProjectArtifactBundle
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class ProjectArtifactBundleFileDetailsEndpointTest(APITestCase):
    @staticmethod
    def get_compressed_zip_file(artifact_name, files, type="artifact.bundle"):
        def remove_and_return(dictionary, key):
            dictionary.pop(key)
            return dictionary

        compressed = io.BytesIO()
        with zipfile.ZipFile(compressed, mode="w") as zip_file:
            for file_path, info in files.items():
                zip_file.writestr(file_path, bytes(info["content"]))

            zip_file.writestr(
                "manifest.json",
                json.dumps(
                    {
                        # We remove the "content" key in the original dict, thus no subsequent calls should be made.
                        "files": {
                            file_path: remove_and_return(info, "content")
                            for file_path, info in files.items()
                        }
                    }
                ),
            )
        compressed.seek(0)

        file = File.objects.create(name=artifact_name, type=type)
        file.putfile(compressed)

        return file

    def test_archive_download(self):
        project = self.create_project(name="foo")

        file = self.get_compressed_zip_file(
            "bundle.zip",
            {
                "files/_/_/index.js.map": {
                    "url": "~/index.js.map",
                    "type": "source_map",
                    "content": b"foo",
                    "headers": {
                        "content-type": "application/json",
                    },
                },
                "files/_/_/index.js": {
                    "url": "~/index.js",
                    "type": "minified_source",
                    "content": b"bar",
                    "headers": {
                        "content-type": "application/json",
                        "sourcemap": "index.js.map",
                    },
                },
            },
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id, bundle_id=uuid4(), file=file, artifact_count=2
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )

        # Download as a user with sufficient role
        url = reverse(
            "sentry-api-0-project-artifact-bundle-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
                "file_id": base64.urlsafe_b64encode(b"files/_/_/index.js.map").decode("utf-8"),
            },
        )

        self.organization.update_option("sentry:debug_files_role", "admin")
        user = self.create_user("baz@localhost")
        self.create_member(user=user, organization=project.organization, role="owner")
        self.login_as(user=user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="index.js.map"'
        assert response.get("Content-Length") == str(3)
        assert response.get("Content-Type") == "application/json"
        assert b"foo" == close_streaming_response(response)

        # Download as a superuser
        url = reverse(
            "sentry-api-0-project-artifact-bundle-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
                "file_id": base64.urlsafe_b64encode(b"files/_/_/index.js").decode("utf-8"),
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="index.js"'
        assert response.get("Content-Length") == str(3)
        assert response.get("Content-Type") == "application/json"
        assert b"bar" == close_streaming_response(response)

        # Download as a superuser with non-existing file
        url = reverse(
            "sentry-api-0-project-artifact-bundle-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
                "file_id": base64.urlsafe_b64encode(b"files/_/_/bundle.js").decode("utf-8"),
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url)
        assert response.status_code == 404, response.content

        # Download as a superuser with invalid base64 file_id
        url = reverse(
            "sentry-api-0-project-artifact-bundle-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
                "file_id": 1234,
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url)
        assert response.status_code == 400, response.content

        # Download as a user without sufficient role
        self.organization.update_option("sentry:debug_files_role", "owner")
        user_no_role = self.create_user("bar@localhost")
        self.create_member(user=user_no_role, organization=project.organization, role="member")
        self.login_as(user=user_no_role)
        response = self.client.get(url)
        assert response.status_code == 403, response.content

        # Download as a user with no permissions
        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url)
        assert response.status_code == 403, response.content

    def test_archive_download_with_invalid_project(self):
        project = self.create_project(name="foo")

        file = self.get_compressed_zip_file(
            "bundle.zip",
            {
                "files/_/_/index.js.map": {
                    "url": "~/index.js.map",
                    "type": "source_map",
                    "content": b"foo",
                    "headers": {
                        "content-type": "application/json",
                    },
                },
                "files/_/_/index.js": {
                    "url": "~/index.js",
                    "type": "minified_source",
                    "content": b"bar",
                    "headers": {
                        "content-type": "application/json",
                        "sourcemap": "index.js.map",
                    },
                },
            },
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id, bundle_id=uuid4(), file=file, artifact_count=2
        )

        # Download as a superuser
        url = reverse(
            "sentry-api-0-project-artifact-bundle-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
                "file_id": base64.urlsafe_b64encode(b"files/_/_/bundle.js").decode("utf-8"),
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url)
        assert response.status_code == 400, response.content
