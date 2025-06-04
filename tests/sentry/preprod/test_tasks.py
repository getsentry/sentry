from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration
from sentry.preprod.tasks import assemble_preprod_artifact
from sentry.tasks.assemble import AssembleTask, ChunkFileState, get_assemble_status
from tests.sentry.tasks.test_assemble import BaseAssembleTest


class AssemblePreprodArtifactTest(BaseAssembleTest):
    def test_assemble_preprod_artifact_success(self):
        content = b"test preprod artifact content"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            git_sha="abc123def456",
            build_configuration="release",
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.OK
        assert details is None

        # Check that the file was created
        files = File.objects.filter(type="preprod.artifact")
        assert len(files) == 1
        assert files[0].checksum == total_checksum
        # Name should start with "preprod-artifact-" and be a UUID since file_name is no longer passed
        assert files[0].name.startswith("preprod-artifact-")

        # Check that PreprodBuildConfiguration was created
        build_configs = PreprodBuildConfiguration.objects.filter(
            project=self.project, name="release"
        )
        assert len(build_configs) == 1

        # Check that PreprodArtifact was created
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        artifact = artifacts[0]
        assert artifact.file_id == files[0].id
        assert artifact.build_configuration == build_configs[0]
        assert artifact.state == PreprodArtifact.ArtifactState.UPLOADED

    def test_assemble_preprod_artifact_without_build_configuration(self):
        content = b"test preprod artifact without build config"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.OK

        # Check that PreprodArtifact was created without build configuration
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        artifact = artifacts[0]
        assert artifact.build_configuration is None
        assert artifact.extras is None

    def test_assemble_preprod_artifact_generates_filename(self):
        content = b"test preprod artifact with generated filename"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.OK

        # Check that a file was created with generated name
        files = File.objects.filter(type="preprod.artifact")
        assert len(files) == 1
        # Name should start with "preprod-artifact-" and be a UUID
        assert files[0].name.startswith("preprod-artifact-")

    def test_assemble_preprod_artifact_checksum_mismatch(self):
        content = b"test content"
        fileobj = ContentFile(content)
        wrong_checksum = "a" * 40  # Wrong checksum

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=wrong_checksum,
            chunks=[blob.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, wrong_checksum
        )
        assert status == ChunkFileState.ERROR
        assert "Reported checksum mismatch" in details

    def test_assemble_preprod_artifact_missing_chunks(self):
        missing_checksum = "nonexistent" + "0" * 32
        total_checksum = sha1(b"test").hexdigest()

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[missing_checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR
        assert "Not all chunks available for assembling" in details

    def test_assemble_preprod_artifact_nonexistent_organization(self):
        content = b"test content"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)
        nonexistent_org_id = 99999

        assemble_preprod_artifact(
            org_id=nonexistent_org_id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, nonexistent_org_id, total_checksum
        )
        assert status == ChunkFileState.ERROR
        assert details is not None

    def test_assemble_preprod_artifact_nonexistent_project(self):
        content = b"test content"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)
        nonexistent_project_id = 99999

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=nonexistent_project_id,
            checksum=total_checksum,
            chunks=[blob.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR
        assert details is not None

    def test_assemble_preprod_artifact_reuses_build_configuration(self):
        # Create an existing build configuration using get_or_create to match the source code pattern
        existing_config, _ = PreprodBuildConfiguration.objects.get_or_create(
            project=self.project, name="debug"
        )

        content = b"test preprod artifact with existing config"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            build_configuration="debug",
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.OK

        # Should only have one build configuration with this name
        build_configs = PreprodBuildConfiguration.objects.filter(project=self.project, name="debug")
        assert len(build_configs) == 1
        assert build_configs[0].id == existing_config.id

        # Check that the artifact uses the existing configuration
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        assert artifacts[0].build_configuration == existing_config

    def test_assemble_preprod_artifact_transaction_rollback(self):
        """Test that if PreprodArtifact creation fails, PreprodBuildConfiguration is also rolled back"""
        content = b"test transaction rollback"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Ensure no build configurations exist initially
        initial_config_count = PreprodBuildConfiguration.objects.filter(
            project=self.project, name="transaction_test"
        ).count()
        assert initial_config_count == 0

        # Mock assemble_file to return a mock result but raise exception in the transaction block
        class MockAssembleResult:
            def __init__(self):
                self.bundle = type("MockBundle", (), {"id": 12345})()

        with (
            patch("sentry.preprod.tasks.assemble_file", return_value=MockAssembleResult()),
            patch.object(
                PreprodArtifact.objects, "create", side_effect=Exception("Simulated failure")
            ),
        ):

            assemble_preprod_artifact(
                org_id=self.organization.id,
                project_id=self.project.id,
                checksum=total_checksum,
                chunks=[blob.checksum],
                build_configuration="transaction_test",
            )

        # Check that the task failed
        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR
        assert "Simulated failure" in details

        # Verify that no PreprodBuildConfiguration was created due to transaction rollback
        final_config_count = PreprodBuildConfiguration.objects.filter(
            project=self.project, name="transaction_test"
        ).count()
        assert final_config_count == 0, "PreprodBuildConfiguration should have been rolled back"

        # Verify that no PreprodArtifact was created either
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 0
