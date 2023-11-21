from datetime import datetime, timedelta

from django.urls import reverse

from sentry.models.artifactbundle import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
@freeze_time("2023-03-15 00:00:00")
class ArtifactBundlesEndpointTest(APITestCase):
    def test_get_artifact_bundles_with_multiple_bundles(self):
        project = self.create_project(name="foo")

        artifact_bundle_1 = self.create_artifact_bundle(
            self.organization,
            artifact_count=2,
            date_uploaded=datetime.now(),
            date_last_modified=datetime.now(),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle_1,
        )

        artifact_bundle_2 = self.create_artifact_bundle(
            self.organization,
            artifact_count=2,
            date_uploaded=datetime.now() + timedelta(hours=1),
            date_last_modified=datetime.now() + timedelta(hours=1),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle_2,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="v1.0",
            dist_name="android",
            artifact_bundle=artifact_bundle_2,
        )

        artifact_bundle_3 = self.create_artifact_bundle(
            self.organization,
            artifact_count=2,
            date_uploaded=datetime.now() + timedelta(hours=2),
            # We also test with the date set to None.
            date_last_modified=None,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle_3,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="v2.0",
            artifact_bundle=artifact_bundle_3,
        )
        debug_id_3 = "71574374-54a1-42fb-943d-4a31677a084c"
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id_3,
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
            artifact_bundle=artifact_bundle_3,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        # We test without search.
        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle_3.bundle_id),
                "associations": [
                    {
                        "release": "v2.0",
                        "dist": None,
                    }
                ],
                "dateModified": None,
                "date": "2023-03-15T02:00:00Z",
                "fileCount": 2,
            },
            {
                "bundleId": str(artifact_bundle_2.bundle_id),
                "associations": [
                    {
                        "release": "v1.0",
                        "dist": "android",
                    }
                ],
                "dateModified": "2023-03-15T01:00:00Z",
                "date": "2023-03-15T01:00:00Z",
                "fileCount": 2,
            },
            {
                "bundleId": str(artifact_bundle_1.bundle_id),
                "associations": [],
                "dateModified": "2023-03-15T00:00:00Z",
                "date": "2023-03-15T00:00:00Z",
                "fileCount": 2,
            },
        ]

        # We test the search with bundle id.
        self.login_as(user=self.user)
        response = self.client.get(url + f"?query={artifact_bundle_2.bundle_id}")

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle_2.bundle_id),
                "associations": [
                    {
                        "release": "v1.0",
                        "dist": "android",
                    }
                ],
                "dateModified": "2023-03-15T01:00:00Z",
                "date": "2023-03-15T01:00:00Z",
                "fileCount": 2,
            },
        ]

        # We test the search with release.
        self.login_as(user=self.user)
        response = self.client.get(url + "?query=v2.0")

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle_3.bundle_id),
                "associations": [
                    {
                        "release": "v2.0",
                        "dist": None,
                    }
                ],
                "dateModified": None,
                "date": "2023-03-15T02:00:00Z",
                "fileCount": 2,
            },
        ]

        # We test the search with dist.
        self.login_as(user=self.user)
        response = self.client.get(url + "?query=android")

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle_2.bundle_id),
                "associations": [
                    {
                        "release": "v1.0",
                        "dist": "android",
                    }
                ],
                "dateModified": "2023-03-15T01:00:00Z",
                "date": "2023-03-15T01:00:00Z",
                "fileCount": 2,
            },
        ]

        # We test the search with debug id.
        self.login_as(user=self.user)
        response = self.client.get(url + f"?query={debug_id_3}")

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle_3.bundle_id),
                "associations": [
                    {
                        "release": "v2.0",
                        "dist": None,
                    }
                ],
                "dateModified": None,
                "date": "2023-03-15T02:00:00Z",
                "fileCount": 2,
            },
        ]

    def test_get_artifact_bundles_with_single_bundle_without_release_dist_pair(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization,
            artifact_count=2,
            date_uploaded=datetime.now(),
            date_last_modified=datetime.now(),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        # We test without search.
        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [],
                "dateModified": "2023-03-15T00:00:00Z",
                "date": "2023-03-15T00:00:00Z",
                "fileCount": 2,
            }
        ]

    def test_get_artifact_bundles_with_multiple_release_dist_pairs_to_same_bundle(self):
        project = self.create_project(name="foo")

        artifact_bundle = self.create_artifact_bundle(
            self.organization,
            artifact_count=2,
            date_uploaded=datetime.now(),
            date_last_modified=datetime.now(),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="android",
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="ios",
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="2.0",
            dist_name="android",
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="2.0",
            dist_name="ios",
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        # We test without search.
        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [
                    {
                        "release": "2.0",
                        "dist": "ios",
                    },
                    {
                        "release": "2.0",
                        "dist": "android",
                    },
                    {
                        "release": "1.0",
                        "dist": "ios",
                    },
                    {
                        "release": "1.0",
                        "dist": "android",
                    },
                ],
                "dateModified": "2023-03-15T00:00:00Z",
                "date": "2023-03-15T00:00:00Z",
                "fileCount": 2,
            },
        ]

        # We test the search with a single release.
        self.login_as(user=self.user)
        response = self.client.get(url + "?query=2.0")

        assert response.status_code == 200, response.content
        # We expect to get back a single entry of the bundle connected to this release.
        assert response.data == [
            {
                "bundleId": str(artifact_bundle.bundle_id),
                "associations": [
                    {
                        "release": "2.0",
                        "dist": "ios",
                    },
                    {
                        "release": "2.0",
                        "dist": "android",
                    },
                    {
                        "release": "1.0",
                        "dist": "ios",
                    },
                    {
                        "release": "1.0",
                        "dist": "android",
                    },
                ],
                "dateModified": "2023-03-15T00:00:00Z",
                "date": "2023-03-15T00:00:00Z",
                "fileCount": 2,
            },
        ]

    def test_get_artifact_bundles_with_no_bundles(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_artifact_bundles_pagination(self):
        project = self.create_project(name="foo")
        for index in range(0, 15):
            artifact_bundle = self.create_artifact_bundle(
                self.organization,
                artifact_count=2,
                date_uploaded=datetime.now() + timedelta(hours=index),
            )
            ProjectArtifactBundle.objects.create(
                organization_id=self.organization.id,
                project_id=project.id,
                artifact_bundle=artifact_bundle,
            )

        for cursor, expected in [("10:0:1", 10), ("10:1:0", 5)]:
            url = reverse(
                "sentry-api-0-artifact-bundles",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                },
            )

            self.login_as(user=self.user)
            response = self.client.get(url + f"?cursor={cursor}")
            assert response.status_code == 200, response.content
            assert len(response.data) == expected

    def test_get_artifact_bundles_sorting(self):
        project = self.create_project(name="foo")
        bundle_ids = []
        for index in range(0, 5):
            artifact_bundle = self.create_artifact_bundle(
                self.organization,
                artifact_count=2,
                date_uploaded=datetime.now() + timedelta(hours=index),
                date_last_modified=datetime.now() + timedelta(hours=index),
            )
            bundle_ids.append(str(artifact_bundle.bundle_id))
            ProjectArtifactBundle.objects.create(
                organization_id=self.organization.id,
                project_id=project.id,
                artifact_bundle=artifact_bundle,
            )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.get(url + "?sortBy=date_added")
        assert response.status_code == 200, response.content
        assert list(map(lambda value: value["bundleId"], response.data)) == bundle_ids

        self.login_as(user=self.user)
        response = self.client.get(url + "?sortBy=-date_added")
        assert response.status_code == 200, response.content
        assert list(map(lambda value: value["bundleId"], response.data)) == bundle_ids[::-1]

        self.login_as(user=self.user)
        response = self.client.get(url + "?sortBy=date_modified")
        assert response.status_code == 200, response.content
        assert list(map(lambda value: value["bundleId"], response.data)) == bundle_ids

        self.login_as(user=self.user)
        response = self.client.get(url + "?sortBy=-date_modified")
        assert response.status_code == 200, response.content
        assert list(map(lambda value: value["bundleId"], response.data)) == bundle_ids[::-1]

        self.login_as(user=self.user)
        response = self.client.get(url + "?sortBy=bundleId")
        assert response.status_code == 400
        assert (
            response.data["detail"]["message"]
            == "You can either sort via 'date_added' or 'date_modified'"
        )

    def test_delete_artifact_bundle_with_single_project_connected(self):
        project = self.create_project(name="foo")
        artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="android",
            artifact_bundle=artifact_bundle,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.delete(url + f"?bundleId={artifact_bundle.bundle_id}")

        assert response.status_code == 204
        # We check that everything connected to this bundle is deleted.
        assert not ArtifactBundle.objects.filter(id=artifact_bundle.id).exists()
        assert not ProjectArtifactBundle.objects.filter(
            artifact_bundle_id=artifact_bundle.id
        ).exists()
        assert not ReleaseArtifactBundle.objects.filter(
            artifact_bundle_id=artifact_bundle.id
        ).exists()
        assert not DebugIdArtifactBundle.objects.filter(
            artifact_bundle_id=artifact_bundle.id
        ).exists()
        assert not File.objects.filter(id=artifact_bundle.file.id).exists()

    def test_delete_artifact_bundle_with_multiple_projects_connected(self):
        project_a = self.create_project(name="foo")
        artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_a.id,
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="android",
            artifact_bundle=artifact_bundle,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
            artifact_bundle=artifact_bundle,
        )

        # We also add an additional project_b to the bundle created above.
        project_b = self.create_project(name="bar")
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_b.id,
            artifact_bundle=artifact_bundle,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={
                "organization_slug": project_a.organization.slug,
                "project_slug": project_a.slug,
            },
        )

        self.login_as(user=self.user)
        response = self.client.delete(url + f"?bundleId={artifact_bundle.bundle_id}")

        assert response.status_code == 204
        assert ArtifactBundle.objects.filter(id=artifact_bundle.id).exists()
        # When deleting this entry, we don't want to delete all the other entries in ReleaseArtifactBundle and
        # DebugIdArtifactBundle, since it is not possible to infer which of them were connected to a specific project
        # , and we don't need to do it since the processing logic checks first all the bundles of a specific project
        # before resolving them.
        assert not ProjectArtifactBundle.objects.filter(
            project_id=project_a.id, artifact_bundle=artifact_bundle
        ).exists()

    def test_delete_artifact_bundles_with_same_bundle_id_and_connected_to_the_same_project(self):
        bundle_id = "42fa3539-63a2-468e-b4e8-81afdd4fdc9e"
        # We create two bundles with the same bundle_id. This is technically not possible anymore, but we still need to
        # support this case since the database was left into an inconsistent state and the consistency is not enforced
        # at the db layer but rather at the application layer, thus we assume only the guarantees at the db level.
        artifact_bundle_a = self.create_artifact_bundle(
            self.organization, bundle_id=bundle_id, artifact_count=2
        )
        artifact_bundle_b = self.create_artifact_bundle(
            self.organization, bundle_id=bundle_id, artifact_count=2
        )

        project_a = self.create_project(name="foo")
        project_b = self.create_project(name="bar")

        # Bundle a is connected to project a and b.
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_a.id,
            artifact_bundle=artifact_bundle_a,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_b.id,
            artifact_bundle=artifact_bundle_a,
        )

        # Bundle b is connected to project a only.
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_a.id,
            artifact_bundle=artifact_bundle_b,
        )

        # We want to remove the bundle with a specific bundle_id from project a.
        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={
                "organization_slug": project_a.organization.slug,
                "project_slug": project_a.slug,
            },
        )

        self.login_as(user=self.user)
        response = self.client.delete(url + f"?bundleId={bundle_id}")

        assert response.status_code == 204
        # We expect the first bundle to be there and only the project reference to be deleted since not
        # all its projects references have been deleted.
        assert ArtifactBundle.objects.filter(id=artifact_bundle_a.id).exists()
        assert ProjectArtifactBundle.objects.filter(
            project_id=project_b.id, artifact_bundle_id=artifact_bundle_a.id
        ).exists()
        assert not ProjectArtifactBundle.objects.filter(
            project_id=project_a.id, artifact_bundle_id=artifact_bundle_a.id
        ).exists()
        # We expect the second bundle to be deleted since all its project references have been deleted.
        assert not ArtifactBundle.objects.filter(id=artifact_bundle_b.id).exists()
        assert not ProjectArtifactBundle.objects.filter(
            project_id=project_a.id, artifact_bundle_id=artifact_bundle_b.id
        ).exists()
