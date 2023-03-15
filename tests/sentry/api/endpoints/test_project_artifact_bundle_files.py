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
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": None,
                "filePath": "files/_/_/bundle1.js",
                "id": b"ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                "size": 71,
                "type": "soure",
            },
            {
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": None,
                "filePath": "files/_/_/bundle1.map.js",
                "id": b"ZmlsZXMvXy9fL2J1bmRsZTEubWFwLmpz",
                "size": None,
                "type": None,
            },
            {
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": None,
                "filePath": "files/_/_/bundle1.min.js",
                "id": b"ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                "size": 63,
                "type": "minified_source",
            },
            {
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": None,
                "filePath": "files/_/_/index.js",
                "id": b"ZmlsZXMvXy9fL2luZGV4Lmpz",
                "size": 3706,
                "type": "source",
            },
            {
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.js.map",
                "id": b"ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                "size": 1804,
                "type": "source_map",
            },
            {
                "dateCreated": "2023-03-15T00:00:00Z",
                "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                "filePath": "files/_/_/index.min.js",
                "id": b"ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                "size": 1676,
                "type": "minified_source",
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
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.js",
                    "id": b"ZmlsZXMvXy9fL2J1bmRsZTEuanM=",
                    "size": 71,
                    "type": "soure",
                },
                {
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.map.js",
                    "id": b"ZmlsZXMvXy9fL2J1bmRsZTEubWFwLmpz",
                    "size": None,
                    "type": None,
                },
            ],
            [
                {
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": None,
                    "filePath": "files/_/_/bundle1.min.js",
                    "id": b"ZmlsZXMvXy9fL2J1bmRsZTEubWluLmpz",
                    "size": 63,
                    "type": "minified_source",
                },
                {
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": None,
                    "filePath": "files/_/_/index.js",
                    "id": b"ZmlsZXMvXy9fL2luZGV4Lmpz",
                    "size": 3706,
                    "type": "source",
                },
            ],
            [
                {
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "files/_/_/index.js.map",
                    "id": b"ZmlsZXMvXy9fL2luZGV4LmpzLm1hcA==",
                    "size": 1804,
                    "type": "source_map",
                },
                {
                    "dateCreated": "2023-03-15T00:00:00Z",
                    "debugId": "eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    "filePath": "files/_/_/index.min.js",
                    "id": b"ZmlsZXMvXy9fL2luZGV4Lm1pbi5qcw==",
                    "size": 1676,
                    "type": "minified_source",
                },
            ],
        ]

        for index, cursor in enumerate(["2:0:1", "2:1:0", "2:2:0"]):
            self.login_as(user=self.user)
            response = self.client.get(url + f"?cursor={cursor}&per_page=2")

            assert response.status_code == 200, response.content
            assert response.data == expected[index]
