from __future__ import annotations

import pytest

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactMobileAppInfo,
    PreprodBuildConfiguration,
)
from sentry.preprod.vcs.pr_comments.templates import format_pr_comment
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class FormatPrCommentTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )
        self.build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )

    def _create_artifact(
        self,
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        app_id="com.example.app",
        app_name="MyApp",
        build_version="1.2.3",
        build_number=456,
        installable_app_file_id=1,
    ) -> PreprodArtifact:
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=artifact_type,
            app_id=app_id,
            build_configuration=self.build_config,
            installable_app_file_id=installable_app_file_id,
        )
        PreprodArtifactMobileAppInfo.objects.create(
            preprod_artifact=artifact,
            app_name=app_name,
            build_version=build_version,
            build_number=build_number,
        )
        # Re-fetch to load relations
        return PreprodArtifact.objects.select_related(
            "mobile_app_info", "build_configuration", "project", "project__organization"
        ).get(id=artifact.id)

    def test_single_ios_artifact(self):
        artifact = self._create_artifact()

        result = format_pr_comment([artifact])

        assert "## Sentry Build Distribution" in result
        assert "| App Name | App ID | Version | Configuration | Install Page |" in result
        assert "MyApp" in result
        assert "com.example.app" in result
        assert "1.2.3 (456)" in result
        assert "Release" in result
        assert "[Install Build](" in result
        # Single platform — no subheader
        assert "### iOS" not in result

    def test_single_android_artifact(self):
        artifact = self._create_artifact(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_name="AndroidApp",
        )

        result = format_pr_comment([artifact])

        assert "AndroidApp" in result
        assert "### Android" not in result

    def test_multiple_platforms_shows_subheaders(self):
        ios_artifact = self._create_artifact(app_name="iOSApp")
        android_artifact = self._create_artifact(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.android",
            app_name="AndroidApp",
        )

        result = format_pr_comment([ios_artifact, android_artifact])

        assert "### iOS" in result
        assert "### Android" in result
        assert "iOSApp" in result
        assert "AndroidApp" in result

    def test_empty_list_raises(self):
        with pytest.raises(ValueError, match="No installable artifacts"):
            format_pr_comment([])
