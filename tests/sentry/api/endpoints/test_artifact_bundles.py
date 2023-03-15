from django.urls import reverse

from sentry.models import ArtifactBundle, ProjectArtifactBundle
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ArtifactBundlesEndpointTest(APITestCase):
    def test_get_artifact_bundles_with_multiple_bundles(self):
        project = self.create_project(name="foo")

        artifact_bundle_1 = self.create_artifact_bundle(self.organization, artifact_count=2)
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle_1,
        )
        artifact_bundle_2 = self.create_artifact_bundle(self.organization, artifact_count=2)
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project.id,
            artifact_bundle=artifact_bundle_2,
        )

        url = reverse(
            "sentry-api-0-artifact-bundles",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        # We expect the first bundle to be the most recent one.
        assert response.data[0]["bundleId"] == str(artifact_bundle_2.bundle_id)
        assert response.data[0]["fileCount"] == 2

        assert response.data[1]["bundleId"] == str(artifact_bundle_1.bundle_id)
        assert response.data[1]["fileCount"] == 2

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
            artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)
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
            artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)
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
        response = self.client.get(url + "?sortBy=name")
        assert response.status_code == 400
        assert response.data["error"] == "You can either sort via 'date_added' or '-date_added'"

    def test_delete_artifact_bundles(self):
        project = self.create_project(name="foo")
        artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=2)
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
        response = self.client.delete(url + f"?bundleId={artifact_bundle.bundle_id}")

        assert response.status_code == 204
        assert not ArtifactBundle.objects.filter(id=artifact_bundle.id).exists()
        assert not ProjectArtifactBundle.objects.filter(
            artifact_bundle_id=artifact_bundle.id
        ).exists()
