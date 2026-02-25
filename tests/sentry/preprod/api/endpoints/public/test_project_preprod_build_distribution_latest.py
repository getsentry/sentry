from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class ProjectPreprodBuildDistributionLatestEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-public-builds"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        self.file = self.create_file(name="test.apk", type="application/octet-stream")
        self.installable_file = self.create_file(
            name="installable.apk", type="application/octet-stream"
        )

        self.build_config = self.create_preprod_build_configuration(
            project=self.project, name="release"
        )

        self.commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )

        self.artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            installable_app_file_id=self.installable_file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            build_configuration=self.build_config,
            commit_comparison=self.commit_comparison,
        )

        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self):
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self):
        return reverse(
            self.endpoint,
            args=[self.organization.slug, self.project.slug],
        )

    def _create_installable_artifact(self, **kwargs):
        """Helper to create an installable artifact with sensible defaults."""
        defaults = {
            "project": self.project,
            "file_id": self.file.id,
            "installable_app_file_id": self.installable_file.id,
            "artifact_type": PreprodArtifact.ArtifactType.APK,
            "app_id": "com.example.app",
            "build_number": 1,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
        }
        defaults.update(kwargs)
        return self.create_preprod_artifact(**defaults)

    def test_feature_flag_disabled(self):
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self.client.get(self._get_url())
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

    def test_empty_results(self):
        PreprodArtifact.objects.all().delete()
        response = self.client.get(self._get_url())
        assert response.status_code == 200
        assert response.json() == []

    def test_list_builds_no_filters(self):
        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        build = data[0]
        assert build["buildId"] == str(self.artifact.id)
        assert build["state"] == "PROCESSED"
        assert build["platform"] == "android"

        assert build["projectId"] == str(self.project.id)
        assert build["projectSlug"] == self.project.slug
        assert build["buildConfiguration"] == "release"
        assert build["appInfo"]["appId"] == "com.example.app"
        assert build["gitInfo"] is not None
        assert build["gitInfo"]["headRef"] == "feature/test"
        assert build["gitInfo"]["prNumber"] == 42
        assert build["downloadCount"] == 0

    def test_excludes_non_installable_builds(self):
        self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_number=2,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_hides_non_processed_builds(self):
        self._create_installable_artifact(state=PreprodArtifact.ArtifactState.UPLOADING)
        self._create_installable_artifact(state=PreprodArtifact.ArtifactState.FAILED)

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_filter_by_platform_apple(self):
        ios_file = self.create_file(name="test.xcarchive", type="application/octet-stream")
        ios_artifact = self._create_installable_artifact(
            file_id=ios_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.iosapp",
        )

        response = self.client.get(self._get_url(), {"platform": "apple"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(ios_artifact.id)
        assert data[0]["platform"] == "apple"

    def test_filter_by_platform_android(self):
        self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.iosapp",
        )

        response = self.client.get(self._get_url(), {"platform": "android"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_filter_by_app_id(self):
        self._create_installable_artifact(app_id="com.other.app")

        response = self.client.get(self._get_url(), {"appId": "com.example.app"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["appInfo"]["appId"] == "com.example.app"

    def test_filter_by_branch(self):
        other_cc = self.create_commit_comparison(
            organization=self.organization,
            head_ref="other-branch",
        )
        self._create_installable_artifact(commit_comparison=other_cc)

        response = self.client.get(self._get_url(), {"branch": "feature/test"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_filter_by_build_version(self):
        self._create_installable_artifact(build_version="2.0.0")

        response = self.client.get(self._get_url(), {"buildVersion": "1.0"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_filter_by_build_configuration(self):
        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")
        self._create_installable_artifact(build_configuration=debug_config)

        response = self.client.get(self._get_url(), {"buildConfiguration": "release"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildConfiguration"] == "release"

    def test_filter_by_pr_number(self):
        other_cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=99,
        )
        self._create_installable_artifact(commit_comparison=other_cc)

        response = self.client.get(self._get_url(), {"prNumber": "42"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["gitInfo"]["prNumber"] == 42

    def test_combined_filters(self):
        response = self.client.get(
            self._get_url(),
            {
                "platform": "android",
                "appId": "com.example.app",
                "branch": "feature/test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_pagination(self):
        for _ in range(3):
            self._create_installable_artifact()

        response = self.client.get(self._get_url(), {"perPage": "2"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_only_returns_builds_for_this_project(self):
        other_project = self.create_project(organization=self.organization)
        self._create_installable_artifact(project=other_project)

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["buildId"] == str(self.artifact.id)

    def test_download_count(self):
        artifact = self._create_installable_artifact()
        self.create_installable_preprod_artifact(preprod_artifact=artifact, download_count=5)

        response = self.client.get(self._get_url())
        assert response.status_code == 200
        data = response.json()
        artifact_data = next(b for b in data if b["buildId"] == str(artifact.id))
        assert artifact_data["downloadCount"] == 5

    def test_aab_artifact_included_in_android_filter(self):
        aab_artifact = self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.aab",
        )

        response = self.client.get(self._get_url(), {"platform": "android"})
        assert response.status_code == 200
        data = response.json()
        build_ids = [b["buildId"] for b in data]
        assert str(self.artifact.id) in build_ids
        assert str(aab_artifact.id) in build_ids
