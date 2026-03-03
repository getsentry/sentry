from django.urls import reverse

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.preprod.models import PreprodArtifact
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class LatestBuildTestBase(APITestCase):
    endpoint = "sentry-api-0-project-preprod-public-builds"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

        token_str = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="Test Token",
                token_hashed=hash_token(token_str),
                scope_list=["project:distribution"],
            )
        self.api_token = token_str

        self.file = self.create_file(name="test.apk", type="application/octet-stream")
        self.installable_file = self.create_file(
            name="installable.apk", type="application/octet-stream"
        )

        self.build_config = self.create_preprod_build_configuration(
            project=self.project, name="release"
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

    def _get(self, url, data=None):
        return self.client.get(url, data, HTTP_AUTHORIZATION=f"Bearer {self.api_token}")

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


class LatestBuildValidationTest(LatestBuildTestBase):
    def test_validation(self):
        # Feature flag disabled
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self._get(
                self._get_url(), {"appId": "com.example.app", "platform": "android"}
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "Feature not enabled"

        # Missing all required params
        assert self._get(self._get_url()).status_code == 400

        # Missing platform
        assert self._get(self._get_url(), {"appId": "com.example.app"}).status_code == 400

        # Missing appId
        assert self._get(self._get_url(), {"platform": "android"}).status_code == 400

        # buildVersion without buildNumber or mainBinaryIdentifier
        assert (
            self._get(
                self._get_url(),
                {"appId": "com.example.app", "platform": "android", "buildVersion": "1.0.0"},
            ).status_code
            == 400
        )


class LatestBuildModeTest(LatestBuildTestBase):
    """Tests for latest-only mode (no buildVersion parameter)."""

    def test_response_fields(self):
        commit_comparison = self.create_commit_comparison(
            organization=self.organization,
            head_ref="feature/test",
            base_ref="main",
            pr_number=42,
        )
        artifact = self._create_installable_artifact(
            build_configuration=self.build_config,
            commit_comparison=commit_comparison,
            extras={"release_notes": "Bug fixes.", "install_groups": ["beta"]},
        )
        self.create_installable_preprod_artifact(preprod_artifact=artifact, download_count=5)

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "android"})
        assert response.status_code == 200
        data = response.json()
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is None

        build = data["latestArtifact"]
        assert build["buildId"] == str(artifact.id)
        assert build["state"] == "PROCESSED"
        assert build["platform"] == "ANDROID"
        assert build["projectId"] == str(self.project.id)
        assert build["projectSlug"] == self.project.slug
        assert build["buildConfiguration"] == "release"
        assert build["appInfo"]["appId"] == "com.example.app"
        assert build["appInfo"]["version"] == "1.0.0"
        assert build["appInfo"]["buildNumber"] == 1
        assert build["gitInfo"] is not None
        assert build["gitInfo"]["headRef"] == "feature/test"
        assert build["gitInfo"]["prNumber"] == 42
        assert build["isInstallable"] is True
        assert build["installUrl"] is not None
        assert build["downloadCount"] == 5
        assert build["releaseNotes"] == "Bug fixes."
        assert build["installGroups"] == ["beta"]
        assert build["isCodeSignatureValid"] is None
        assert build["profileName"] is None
        assert build["codesigningType"] is None

    def test_no_matching_build(self):
        response = self._get(
            self._get_url(), {"appId": "com.nonexistent.app", "platform": "android"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["latestArtifact"] is None
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is None

    def test_version_ordering_and_build_number_tiebreaker(self):
        # Semver comparison picks highest version
        self._create_installable_artifact(build_version="1.0.0", build_number=1)
        self._create_installable_artifact(build_version="2.0.0", build_number=1)
        self._create_installable_artifact(build_version="1.9.0", build_number=1)

        # Same highest version: build number is the tiebreaker
        self._create_installable_artifact(build_version="10.0.0", build_number=1)
        highest = self._create_installable_artifact(build_version="10.0.0", build_number=5)
        self._create_installable_artifact(build_version="10.0.0", build_number=3)

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "android"})
        assert response.json()["latestArtifact"]["buildId"] == str(highest.id)

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
        # Non-processed state
        self._create_installable_artifact(
            build_version="4.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )
        installable = self._create_installable_artifact(build_version="1.0.0", build_number=1)

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "android"})
        assert response.json()["latestArtifact"]["buildId"] == str(installable.id)

    def test_only_returns_builds_for_this_project(self):
        other_project = self.create_project(organization=self.organization)
        self._create_installable_artifact(
            project=other_project, build_version="99.0.0", build_number=1
        )
        artifact = self._create_installable_artifact(build_version="1.0.0", build_number=1)

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "android"})
        assert response.json()["latestArtifact"]["buildId"] == str(artifact.id)


class LatestBuildFilteringTest(LatestBuildTestBase):
    """Tests for explicit filter parameters (platform, buildConfiguration, etc.)."""

    def test_platform_filter_apple(self):
        ios_file = self.create_file(name="test.xcarchive", type="application/octet-stream")
        ios_artifact = self._create_installable_artifact(
            file_id=ios_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            extras={"is_code_signature_valid": True},
        )
        # Android artifact should NOT be returned for apple
        self._create_installable_artifact(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            build_version="3.0.0",
            build_number=99,
        )
        # Apple artifact with invalid code signature should be excluded
        self._create_installable_artifact(
            file_id=ios_file.id,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            build_version="5.0.0",
            build_number=1,
            extras={"is_code_signature_valid": False},
        )

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "apple"})
        data = response.json()
        assert data["latestArtifact"]["buildId"] == str(ios_artifact.id)
        assert data["latestArtifact"]["platform"] == "APPLE"

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

        response = self._get(self._get_url(), {"appId": "com.example.app", "platform": "android"})
        assert response.json()["latestArtifact"]["buildId"] == str(apk_artifact.id)

    def test_explicit_filters(self):
        debug_config = self.create_preprod_build_configuration(project=self.project, name="debug")

        self._create_installable_artifact(
            build_configuration=self.build_config, build_version="1.0.0", build_number=1
        )
        debug_artifact = self._create_installable_artifact(
            build_configuration=debug_config, build_version="2.0.0", build_number=1
        )

        # Build configuration filter
        response = self._get(
            self._get_url(),
            {"appId": "com.example.app", "platform": "android", "buildConfiguration": "debug"},
        )
        assert response.json()["latestArtifact"]["buildId"] == str(debug_artifact.id)

        # Codesigning type filter
        enterprise = self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={"codesigning_type": "enterprise"},
        )
        response = self._get(
            self._get_url(),
            {"appId": "com.example.app", "platform": "android", "codesigningType": "enterprise"},
        )
        assert response.json()["latestArtifact"]["buildId"] == str(enterprise.id)

        # Install groups filter
        beta = self._create_installable_artifact(
            build_version="4.0.0",
            build_number=1,
            extras={"install_groups": ["beta-testers"]},
        )
        response = self._get(
            self._get_url(),
            {"appId": "com.example.app", "platform": "android", "installGroups": "beta-testers"},
        )
        assert response.json()["latestArtifact"]["buildId"] == str(beta.id)

        # Combined: codesigning_type + build_configuration
        combo = self._create_installable_artifact(
            build_version="5.0.0",
            build_number=1,
            build_configuration=debug_config,
            extras={"codesigning_type": "enterprise"},
        )
        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildConfiguration": "debug",
                "codesigningType": "enterprise",
            },
        )
        assert response.json()["latestArtifact"]["buildId"] == str(combo.id)

    def test_filter_no_match(self):
        self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"codesigning_type": "development"},
        )

        response = self._get(
            self._get_url(),
            {"appId": "com.example.app", "platform": "android", "codesigningType": "enterprise"},
        )
        assert response.json()["latestArtifact"] is None

    def test_install_groups_multiple_and_query_param_array(self):
        self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"install_groups": ["beta", "internal"]},
        )
        newer = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"install_groups": ["beta", "staging"]},
        )

        response = self._get(
            self._get_url() + "?appId=com.example.app&platform=android"
            "&installGroups=beta&installGroups=staging"
        )
        assert response.status_code == 200
        assert response.json()["latestArtifact"]["buildId"] == str(newer.id)


class CheckForUpdatesTest(LatestBuildTestBase):
    """Tests for check-for-updates mode (buildVersion parameter provided)."""

    def test_update_available(self):
        current = self._create_installable_artifact(build_version="1.0.0", build_number=1)
        newer = self._create_installable_artifact(build_version="2.0.0", build_number=1)

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)
        assert data["currentArtifact"]["appInfo"]["version"] == "1.0.0"

    def test_already_on_latest(self):
        artifact = self._create_installable_artifact(build_version="2.0.0", build_number=1)

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "2.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is False
        assert data["latestArtifact"]["buildId"] == str(artifact.id)
        assert data["currentArtifact"]["buildId"] == str(artifact.id)

    def test_current_not_found(self):
        latest = self._create_installable_artifact(build_version="2.0.0", build_number=1)

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "0.5.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(latest.id)
        assert data["currentArtifact"] is None

    def test_no_builds_exist(self):
        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["latestArtifact"] is None
        assert data["currentArtifact"] is None
        assert data["updateAvailable"] is False

    def test_main_binary_identifier_matching(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            main_binary_identifier="com.example.app.binary",
        )
        newer = self._create_installable_artifact(build_version="2.0.0", build_number=1)

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "mainBinaryIdentifier": "com.example.app.binary",
            },
        )
        data = response.json()
        assert data["currentArtifact"]["buildId"] == str(current.id)
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["updateAvailable"] is True

    def test_filter_inheritance_build_configuration(self):
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
        # Debug artifact with higher version — should NOT be returned
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            build_configuration=debug_config,
        )

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer_release.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_filter_inheritance_codesigning_type(self):
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
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={"codesigning_type": "enterprise"},
        )

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer_dev.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_filter_inheritance_install_groups(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={"install_groups": ["beta"]},
        )
        newer = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={"install_groups": ["beta"]},
        )
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={"install_groups": ["internal"]},
        )

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)

    def test_combined_filter_inheritance(self):
        current = self._create_installable_artifact(
            build_version="1.0.0",
            build_number=1,
            extras={
                "codesigning_type": "development",
                "install_groups": ["beta"],
            },
        )
        newer_match = self._create_installable_artifact(
            build_version="2.0.0",
            build_number=1,
            extras={
                "codesigning_type": "development",
                "install_groups": ["beta"],
            },
        )
        # Different codesigning — should NOT match
        self._create_installable_artifact(
            build_version="3.0.0",
            build_number=1,
            extras={
                "codesigning_type": "enterprise",
                "install_groups": ["beta"],
            },
        )

        response = self._get(
            self._get_url(),
            {
                "appId": "com.example.app",
                "platform": "android",
                "buildVersion": "1.0.0",
                "buildNumber": "1",
            },
        )
        data = response.json()
        assert data["updateAvailable"] is True
        assert data["latestArtifact"]["buildId"] == str(newer_match.id)
        assert data["currentArtifact"]["buildId"] == str(current.id)
