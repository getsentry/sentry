from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactMobileAppInfo,
    PreprodBuildConfiguration,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class IsInstallableArtifactTest(TestCase):
    def _create_artifact(
        self,
        artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        installable_app_file_id=1,
        build_number="456",
        extras=None,
    ) -> PreprodArtifact:
        build_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="Release"
        )
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=artifact_type,
            app_id="com.example.app",
            build_configuration=build_config,
            installable_app_file_id=installable_app_file_id,
            extras=extras,
        )
        PreprodArtifactMobileAppInfo.objects.create(
            preprod_artifact=artifact,
            app_name="TestApp",
            build_version="1.0.0",
            build_number=build_number,
        )
        return PreprodArtifact.objects.select_related("mobile_app_info").get(id=artifact.id)

    def test_xcarchive_with_valid_signature_is_installable(self) -> None:
        artifact = self._create_artifact(extras={"is_code_signature_valid": True})
        assert is_installable_artifact(artifact) is True

    def test_xcarchive_without_valid_signature_is_not_installable(self) -> None:
        artifact = self._create_artifact(extras={"is_code_signature_valid": False})
        assert is_installable_artifact(artifact) is False

    def test_xcarchive_with_app_store_codesigning_is_not_installable(self) -> None:
        artifact = self._create_artifact(
            extras={"is_code_signature_valid": True, "codesigning_type": "app-store"}
        )
        assert is_installable_artifact(artifact) is False

    def test_xcarchive_without_installable_app_file_is_not_installable(self) -> None:
        artifact = self._create_artifact(
            installable_app_file_id=None, extras={"is_code_signature_valid": True}
        )
        assert is_installable_artifact(artifact) is False

    def test_aab_is_installable(self) -> None:
        artifact = self._create_artifact(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            extras=None,
        )
        assert is_installable_artifact(artifact) is True
