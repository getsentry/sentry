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
            "build_version": "1.0.0",
            "build_number": 1,
            "state": PreprodArtifact.ArtifactState.PROCESSED,
        }
        defaults.update(kwargs)
        return self.create_preprod_artifact(**defaults)

    def test_feature_flag_disabled(self):
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self.client.get(
                self._get_url(), {"appId": "com.example.app", "platform": "android"}
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

    def test_missing_required_params(self):
        response = self.client.get(self._get_url())
        assert response.status_code == 400

        response = self.client.get(self._get_url(), {"appId": "com.example.app"})
        assert response.status_code == 400

        response = self.client.get(self._get_url(), {"platform": "android"})
        assert response.status_code == 400

    def test_build_version_requires_identifier(self):
        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
            },
        )
        assert response.status_code == 400

    def test_latest_mode_returns_latest_build(self):
        artifact = self._create_installable_artifact()

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is not None
        assert data["latestArtifact"]["buildId"] == str(artifact.id)
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is None

    def test_latest_mode_no_matching_build(self):
        response = self.client.get(
            self._get_url(), {"appId": "com.nonexistent.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is None
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is None

    def test_latest_mode_response_fields(self):
        artifact = self._create_installable_artifact(
            build_configuration=self.build_config,
            commit_comparison=self.commit_comparison,
            extras={"release_notes": "Bug fixes.", "install_groups": ["beta"]},
        )

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        build = response.json()["latestArtifact"]
        assert build["buildId"] == str(artifact.id)
        assert build["state"] == "PROCESSED"
        assert build["platform"] == "android"
        assert build["projectId"] == str(self.project.id)
        assert build["projectSlug"] == self.project.slug
        assert build["buildConfiguration"] == "release"
        assert build["appInfo"]["appId"] == "com.example.app"
        assert build["appInfo"]["version"] == "1.0.0"
        assert build["appInfo"]["buildNumber"] == 1
        assert build["gitInfo"] is not None
        assert build["gitInfo"]["headRef"] == "feature/test"
        assert build["gitInfo"]["prNumber"] == 42
        assert build["downloadCount"] == 0
        assert build["releaseNotes"] == "Bug fixes."
        assert build["installGroups"] == ["beta"]

    def test_check_for_updates_update_available(self):
        self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
        )
        newer = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["currentArtifact"] is not None
        assert data["currentArtifact"]["appInfo"]["version"] == "1.0.0"

    def test_check_for_updates_already_on_latest(self):
        artifact = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "2.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is False
        assert data["latestArtifact"]["buildId"] == str(artifact.id)
        assert data["currentArtifact"]["buildId"] == str(artifact.id)

    def test_check_for_updates_current_not_found(self):
        latest = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "0.5.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(latest.id)
        assert data["currentArtifact"] is None

    def test_platform_filter_apple(self):
        ios_file = self.create_file(name="test.xcarchive", type="application/octet-stream")
        ios_artifact = self._create_installable_artifact(
            file_id=ios_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        )
        # Create an Android artifact that should not be returned
        self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="3.0.0",
            build_number=99,
        )

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "apple"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is not None
        assert data["latestArtifact"]["buildId"] == str(ios_artifact.id)
        assert data["latestArtifact"]["platform"] == "apple"

    def test_platform_filter_android_includes_aab(self):
        self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            build_version="2.0.0",
            build_number=1,
        )
        apk_artifact = self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="2.0.0",
            build_number=2,
        )

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is not None
        # Should pick the highest build number among same version
        assert data["latestArtifact"]["buildId"] == str(apk_artifact.id)

    def test_build_configuration_filter(self):
        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")
        self._create_installable_artifact(
            build_configuration=self.build_config,
            build_version="1.0.0",
            build_number=1,
        )
        debug_artifact = self._create_installable_artifact(
            build_configuration=debug_config,
            build_version="2.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildConfiguration": "debug",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(debug_artifact.id)

    def test_codesigning_type_filter(self):
        self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"codesigning_type": "development"},
        )
        enterprise_artifact = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"codesigning_type": "enterprise"},
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "codesigningType": "enterprise",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(enterprise_artifact.id)

    def test_install_groups_filter(self):
        self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"install_groups": ["internal"]},
        )
        beta_artifact = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"install_groups": ["beta-testers"]},
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "installGroups": "beta-testers",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(beta_artifact.id)

    def test_install_groups_inheritance_from_current(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"install_groups": ["beta"]},
        )
        # This newer artifact is in the "beta" group too — should be found via inheritance
        newer = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"install_groups": ["beta"]},
        )
        # This newer artifact is in a different group — should NOT be found
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={"install_groups": ["internal"]},
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_semver_comparison_picks_highest_version(self):
        # Create artifacts with different versions — not in semver order
        self._create_installable_artifact(build_version="1.0.0", build_number=1)
        highest = self._create_installable_artifact(build_version="10.0.0", build_number=1)
        self._create_installable_artifact(build_version="2.0.0", build_number=1)
        self._create_installable_artifact(build_version="1.9.0", build_number=1)

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(highest.id)

    def test_build_number_tiebreaker(self):
        self._create_installable_artifact(build_version="1.0.0", build_number=1)
        highest_build = self._create_installable_artifact(build_version="1.0.0", build_number=5)
        self._create_installable_artifact(build_version="1.0.0", build_number=3)

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(highest_build.id)

    def test_main_binary_identifier_matching(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            main_binary_identifier="com.example.app.binary",
        )
        newer = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "mainBinaryIdentifier": "com.example.app.binary",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["currentArtifact"]["buildId"] == str(current.id)
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["updateAvailable"] is True

    def test_excludes_non_installable_builds(self):
        # No installable file
        self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            build_version="3.0.0",
            build_number=99,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        # Non-processed states
        self._create_installable_artifact(
            build_version="4.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )
        installable = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is not None
        assert data["latestArtifact"]["buildId"] == str(installable.id)

    def test_only_returns_builds_for_this_project(self):
        other_project = self.create_project(organization=self.organization)
        self._create_installable_artifact(
            project=other_project,
            build_version="99.0.0",
            build_number=1,
        )
        artifact = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
        )

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(artifact.id)

    def test_download_count(self):
        artifact = self._create_installable_artifact()
        self.create_installable_preprod_artifact(preprod_artifact=artifact, download_count=5)

        response = self.client.get(
            self._get_url(), {"appId": "com.example.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"]["downloadCount"] == 5

    def test_codesigning_type_inheritance_from_current(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"codesigning_type": "development"},
        )
        newer_dev = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"codesigning_type": "development"},
        )
        # Enterprise artifact with higher version should NOT be found
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={"codesigning_type": "enterprise"},
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer_dev.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_build_configuration_inheritance_from_current(self):
        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            build_configuration=self.build_config,
        )
        newer_release = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            build_configuration=self.build_config,
        )
        # Debug artifact with higher version should NOT be found
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            build_configuration=debug_config,
        )

        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer_release.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_check_for_updates_no_builds_exist(self):
        response = self.client.get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is None
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is False
