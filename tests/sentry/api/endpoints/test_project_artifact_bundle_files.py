from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from sentry.models.artifactbundle import ProjectArtifactBundle, ReleaseArtifactBundle
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
@freeze_time("2023-03-15 00:00:00")
class ProjectArtifactBundleFilesEndpointTest(APITestCase):
    def test_get_artifact_bundle_files_with_multiple_files(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization,
            artifact_count=6,
            fixture_path="artifact_bundle_debug_ids",
            date_last_modified=(timezone.now() + timedelta(hours=1)),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )
        # We simulate the existence of multiple release/dist pairs for this specific bundle.
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="android",
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="2.0",
            dist_name="android",
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
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [
                {"release": "2.0", "dist": "android"},
                {"release": "1.0", "dist": "android"},
            ],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": "2023-03-15T01:00:00Z",
            "fileCount": 6,
            "files": [
                {
                    "debugId": None,
                    "filePath": "~/bundle1.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                    "fileSize": 71,
                    "fileType": 0,
                    "sourcemap": None,
                },
                {
                    "debugId": None,
                    "filePath": "~/bundle1.min.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                    "fileSize": 63,
                    "fileType": 2,
                    "sourcemap": "bundle1.js.map",
                },
                {
                    "debugId": None,
                    "filePath": "~/bundle1.min.js.map",
                    "fileSize": 139,
                    "fileType": 0,
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
                    "sourcemap": None,
                },
                {
                    "debugId": None,
                    "filePath": "~/index.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lmpz",
                    "fileSize": 3706,
                    "fileType": 1,
                    "sourcemap": None,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.js.map",
                    "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "fileSize": 1804,
                    "fileType": 3,
                    "sourcemap": None,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.min.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "fileSize": 1676,
                    "fileType": 2,
                    "sourcemap": "index.js.map",
                },
            ],
        }

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
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
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
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [{"release": "1.0", "dist": None}],
                "date": "2023-03-15T00:00:00Z",
                "dateModified": None,
                "fileCount": 6,
                "files": [
                    {
                        "debugId": None,
                        "filePath": "~/bundle1.js",
                        "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                        "fileSize": 71,
                        "fileType": 0,
                        "sourcemap": None,
                    },
                    {
                        "debugId": None,
                        "filePath": "~/bundle1.min.js",
                        "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                        "fileSize": 63,
                        "fileType": 2,
                        "sourcemap": "bundle1.js.map",
                    },
                ],
            },
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [{"release": "1.0", "dist": None}],
                "date": "2023-03-15T00:00:00Z",
                "dateModified": None,
                "fileCount": 6,
                "files": [
                    {
                        "debugId": None,
                        "filePath": "~/bundle1.min.js.map",
                        "fileSize": 139,
                        "fileType": 0,
                        "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
                        "sourcemap": None,
                    },
                    {
                        "debugId": None,
                        "filePath": "~/index.js",
                        "id": "ZmlsZXMvXy9fL2luZGV4Lmpz",
                        "fileSize": 3706,
                        "fileType": 1,
                        "sourcemap": None,
                    },
                ],
            },
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [{"release": "1.0", "dist": None}],
                "date": "2023-03-15T00:00:00Z",
                "dateModified": None,
                "fileCount": 6,
                "files": [
                    {
                        "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                        "filePath": "~/index.js.map",
                        "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                        "fileSize": 1804,
                        "fileType": 3,
                        "sourcemap": None,
                    },
                    {
                        "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                        "filePath": "~/index.min.js",
                        "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                        "fileSize": 1676,
                        "fileType": 2,
                        "sourcemap": "index.js.map",
                    },
                ],
            },
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
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": None,
            "fileCount": 6,
            "files": [
                {
                    "debugId": None,
                    "filePath": "~/bundle1.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                    "fileSize": 71,
                    "fileType": 0,
                    "sourcemap": None,
                },
            ],
        }

        # file_path match across multiple files.
        query = "bundle"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": None,
            "fileCount": 6,
            "files": [
                {
                    "debugId": None,
                    "filePath": "~/bundle1.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                    "fileSize": 71,
                    "fileType": 0,
                    "sourcemap": None,
                },
                {
                    "debugId": None,
                    "filePath": "~/bundle1.min.js",
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                    "fileSize": 63,
                    "fileType": 2,
                    "sourcemap": "bundle1.js.map",
                },
                {
                    "debugId": None,
                    "filePath": "~/bundle1.min.js.map",
                    "fileSize": 139,
                    "fileType": 0,
                    "id": "ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpzLm1hcA==",
                    "sourcemap": None,
                },
            ],
        }

        # debug_id match.
        query = "eb6e60f1-65ff-"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": None,
            "fileCount": 6,
            "files": [
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.js.map",
                    "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "fileSize": 1804,
                    "fileType": 3,
                    "sourcemap": None,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.min.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "fileSize": 1676,
                    "fileType": 2,
                    "sourcemap": "index.js.map",
                },
            ],
        }

        query = "eb6e60f165ff4f6fadfff1bbeded627b"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": None,
            "fileCount": 6,
            "files": [
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.js.map",
                    "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "fileSize": 1804,
                    "fileType": 3,
                    "sourcemap": None,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.min.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "fileSize": 1676,
                    "fileType": 2,
                    "sourcemap": "index.js.map",
                },
            ],
        }

        query = "EB6e60f165ff4f6fadfff1BBEded627b"
        response = self.client.get(url + f"?query={query}")
        assert response.status_code == 200, response.content
        assert response.data == {
            "bundleId": str(artifact_bundle.bundle_id),
            "associations": [],
            "date": "2023-03-15T00:00:00Z",
            "dateModified": None,
            "fileCount": 6,
            "files": [
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.js.map",
                    "id": "ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "fileSize": 1804,
                    "fileType": 3,
                    "sourcemap": None,
                },
                {
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "~/index.min.js",
                    "id": "ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "fileSize": 1676,
                    "fileType": 2,
                    "sourcemap": "index.js.map",
                },
            ],
        }
