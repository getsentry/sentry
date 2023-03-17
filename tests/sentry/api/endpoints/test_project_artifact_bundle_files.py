from django.urls import reverse
from freezegun import freeze_time

from sentry.models import ProjectArtifactBundle
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@freeze_time("2023-03-15 00:00:00")
class ProjectArtifactBundleFilesEndpointTest(APITestCase):
    def test_get_artifact_bundle_files_with_multiple_files(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization, artifact_count=6, fixture_path="artifact_bundle_debug_ids"
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-project-artifact-bundle-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
            },
        )

        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.js",
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                "fileSize": 71,
                "fileType": 0,
            },
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.min.js",
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                "fileSize": 63,
                "fileType": 2,
            },
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.min.js.map",
                "fileSize": 139,
                "fileType": 0,
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
            },
            {
                "debugId": None,
                "filePath": "files/_/_/index.js",
                "id": "ZmlsZXMvXy9fL2luZGV4Lmpz",
                "fileSize": 3706,
                "fileType": 1,
            },
            {
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.js.map",
                "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                "fileSize": 1804,
                "fileType": 3,
            },
            {
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.min.js",
                "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                "fileSize": 1676,
                "fileType": 2,
            },
        ]

    def test_get_artifact_bundle_files_pagination_with_multiple_files(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization, artifact_count=6, fixture_path="artifact_bundle_debug_ids"
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-project-artifact-bundle-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
            },
        )

        expected = [
            [
                {
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                    "fileSize": 71,
                    "fileType": 0,
                },
                {
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.min.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                    "fileSize": 63,
                    "fileType": 2,
                },
            ],
            [
                {
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.min.js.map",
                    "fileSize": 139,
                    "fileType": 0,
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
                },
                {
                    "debugId": None,
                    "filePath": "files/_/_/index.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lmpz",
                    "fileSize": 3706,
                    "fileType": 1,
                },
            ],
            [
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "files/_/_/index.js.map",
                    "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "fileSize": 1804,
                    "fileType": 3,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "files/_/_/index.min.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "fileSize": 1676,
                    "fileType": 2,
                },
            ],
        ]

        for index, cursor in enumerate(["2:0:1", "2:1:0", "2:2:0"]):
            self.login_as(user=self.user)
            response = self.client.get(url + f"?cursor={cursor}&per_page=2")

            assert response.status_code == 200, response.content
            assert response.data == expected[index]

    def test_get_artifact_bundle_files_with_multiple_files_and_search_query(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization, artifact_count=6, fixture_path="artifact_bundle_debug_ids"
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-project-artifact-bundle-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "bundle_id": artifact_bundle.bundle_id,
            },
        )

        self.login_as(user=self.user)

        # file_path match with single file.
        query = "bundle1.js"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.js",
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                "fileSize": 71,
                "fileType": 0,
            },
        ]

        # file_path match across multiple files.
        query = "bundle"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.js",
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                "fileSize": 71,
                "fileType": 0,
            },
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.min.js",
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                "fileSize": 63,
                "fileType": 2,
            },
            {
                "debugId": None,
                "filePath": "files/_/_/bundle1.min.js.map",
                "fileSize": 139,
                "fileType": 0,
                "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
            },
        ]

        # debug_id match.
        query = "eb6e60f1-65ff-"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.js.map",
                "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                "fileSize": 1804,
                "fileType": 3,
            },
            {
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.min.js",
                "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                "fileSize": 1676,
                "fileType": 2,
            },
        ]
