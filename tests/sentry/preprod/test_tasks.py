from datetime import timedelta
from hashlib import sha1

from django.core.files.base import ContentFile
from django.utils import timezone

from sentry.models.commitcomparison import CommitComparison
from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.preprod.tasks import (
    assemble_preprod_artifact,
    assemble_preprod_artifact_installable_app,
    assemble_preprod_artifact_size_analysis,
    create_preprod_artifact,
    detect_expired_preprod_artifacts,
)
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    delete_assemble_status,
    get_assemble_status,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist
from tests.sentry.tasks.test_assemble import BaseAssembleTest


@thread_leak_allowlist(reason="preprod tasks", issue=97039)
class AssemblePreprodArtifactTest(BaseAssembleTest):
    def tearDown(self) -> None:
        """Clean up assembly status and force garbage collection to close unclosed files"""
        import gc

        # Force garbage collection to clean up any unclosed file handles
        gc.collect()

        super().tearDown()

    def test_assemble_preprod_artifact_success(self) -> None:
        """Test that assemble_preprod_artifact succeeds with build_configuration"""
        content = b"test preprod artifact content"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration="release",
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
            build_configuration="release",
        )

        # The main assemble_preprod_artifact task doesn't set assembly status
        # Only the assemble_file function sets error status when there are problems
        # So we should check the actual artifacts created instead

        # Verify file was created
        files = File.objects.filter(type="preprod.artifact")
        assert len(files) == 1
        assert files[0].checksum == total_checksum
        assert files[0].name.startswith("preprod-artifact-")

        # Verify database records were created successfully
        build_configs = PreprodBuildConfiguration.objects.filter(project=self.project)
        assert len(build_configs) == 1
        assert build_configs[0].name == "release"

        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        assert artifacts[0].file_id == files[0].id
        assert artifacts[0].build_configuration == build_configs[0]

        delete_assemble_status(AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum)

    def test_create_preprod_artifact_with_release_notes(self) -> None:
        """Test that create_preprod_artifact stores release_notes in extras field"""
        content = b"test preprod artifact with release notes"
        total_checksum = sha1(content).hexdigest()

        # Create preprod artifact with release notes
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration="release",
            release_notes="This is a test release with important changes",
        )
        assert artifact is not None

        # Verify the artifact was created with release notes in extras
        assert artifact.extras is not None
        assert artifact.extras["release_notes"] == "This is a test release with important changes"

        # Clean up
        delete_assemble_status(AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum)

    def test_assemble_preprod_artifact_with_commit_comparison(self) -> None:
        content = b"test preprod artifact with commit comparison"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration="release",
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        # The main assemble_preprod_artifact task doesn't set assembly status
        # Only the assemble_file function sets error status when there are problems
        # So we should check the actual artifacts created instead

        # Verify CommitComparison was created
        commit_comparisons = CommitComparison.objects.filter(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
        )
        assert len(commit_comparisons) == 1
        commit_comparison = commit_comparisons[0]
        assert commit_comparison.provider == "github"
        assert commit_comparison.head_repo_name == "owner/repo"
        assert commit_comparison.base_repo_name == "owner/repo"
        assert commit_comparison.head_ref == "feature/xyz"
        assert commit_comparison.base_ref == "main"
        assert commit_comparison.pr_number == 123

        # Verify PreprodArtifact was created
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1

    def test_assemble_preprod_artifact_without_build_configuration(self) -> None:
        """Test that assemble_preprod_artifact succeeds without build_configuration"""
        content = b"test preprod artifact without build config"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
        )

        # The main assemble_preprod_artifact task doesn't set assembly status

        # Verify file was created
        files = File.objects.filter(type="preprod.artifact")
        assert len(files) == 1

        # Verify artifact was created with no build configuration
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        assert artifacts[0].build_configuration is None
        assert artifacts[0].state == PreprodArtifact.ArtifactState.UPLOADED

    def test_assemble_preprod_artifact_generates_filename(self) -> None:
        """Test that assemble_preprod_artifact generates proper filename"""
        content = b"test preprod artifact with generated filename"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
        )

        # The main assemble_preprod_artifact task doesn't set assembly status

        files = File.objects.filter(type="preprod.artifact")
        assert len(files) == 1
        assert files[0].name.startswith("preprod-artifact-")

        # Verify database records were created successfully
        artifacts = PreprodArtifact.objects.filter(project=self.project)
        assert len(artifacts) == 1
        assert artifacts[0].build_configuration is None
        assert artifacts[0].state == PreprodArtifact.ArtifactState.UPLOADED

    def test_assemble_preprod_artifact_checksum_mismatch(self) -> None:
        content = b"test content for checksum mismatch"
        fileobj = ContentFile(content)
        wrong_checksum = "a" * 40

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=wrong_checksum,
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=wrong_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, wrong_checksum
        )
        assert status == ChunkFileState.ERROR
        assert "Reported checksum mismatch" in details

        delete_assemble_status(AssembleTask.PREPROD_ARTIFACT, self.project.id, wrong_checksum)

    def test_assemble_preprod_artifact_missing_chunks(self) -> None:
        missing_checksum = "nonexistent" + "0" * 32
        total_checksum = sha1(b"test for missing chunks").hexdigest()

        # Create preprod artifact first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None

        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[missing_checksum],
            artifact_id=artifact.id,
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum
        )
        assert status == ChunkFileState.ERROR
        assert "Not all chunks available for assembling" in details

        delete_assemble_status(AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum)

    def test_assemble_preprod_artifact_nonexistent_organization(self) -> None:
        content = b"test content for nonexistent org"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)
        nonexistent_org_id = 99999

        # Create preprod artifact with valid org first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None

        # Then try to assemble with nonexistent org
        assemble_preprod_artifact(
            org_id=nonexistent_org_id,
            project_id=self.project.id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
        )

        # The task catches exceptions but doesn't set assembly status for database errors
        # Check that the artifact was marked as failed instead
        artifacts = PreprodArtifact.objects.filter(id=artifact.id)
        assert len(artifacts) == 1
        assert artifacts[0].state == PreprodArtifact.ArtifactState.FAILED

    def test_assemble_preprod_artifact_nonexistent_project(self) -> None:
        content = b"test content for nonexistent project"
        fileobj = ContentFile(content)
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file_with_organization(fileobj, self.organization)
        nonexistent_project_id = 99999

        # Create preprod artifact with valid project first
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None

        # Then try to assemble with nonexistent project
        assemble_preprod_artifact(
            org_id=self.organization.id,
            project_id=nonexistent_project_id,
            checksum=total_checksum,
            chunks=[blob.checksum],
            artifact_id=artifact.id,
        )

        # The task catches exceptions but doesn't set assembly status for database errors
        # Check that the artifact was marked as failed instead
        artifacts = PreprodArtifact.objects.filter(id=artifact.id)
        assert len(artifacts) == 1
        assert artifacts[0].state == PreprodArtifact.ArtifactState.FAILED

    # Note: Tests currently expect ERROR state because the task tries to access
    # assemble_result.build_configuration which doesn't exist


class CreatePreprodArtifactTest(TestCase):
    def test_create_preprod_artifact_with_all_vcs_params_succeeds(self) -> None:
        """Test that create_preprod_artifact succeeds when all required VCS params are provided"""
        content = b"test with all VCS params"
        total_checksum = sha1(content).hexdigest()

        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            head_sha="a" * 40,
            provider="github",
            head_repo_name="owner/repo",
            head_ref="feature/xyz",
            # Optional parameters
            base_sha="b" * 40,
            base_repo_name="owner/repo",
            base_ref="main",
            pr_number=123,
        )

        assert artifact is not None
        assert artifact.commit_comparison is not None

    def test_create_preprod_artifact_with_no_vcs_params_succeeds(self) -> None:
        """Test that create_preprod_artifact succeeds when no VCS params are provided"""
        content = b"test with no VCS params"
        total_checksum = sha1(content).hexdigest()

        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )

        assert artifact is not None
        assert artifact.commit_comparison is None


class AssemblePreprodArtifactInstallableAppTest(BaseAssembleTest):
    def setUp(self) -> None:
        super().setUp()
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project, state=PreprodArtifact.ArtifactState.UPLOADED
        )

    def _run_task_and_verify_status(
        self, content, checksum=None, chunks=None, artifact_id=None, org_id=None, project_id=None
    ):
        checksum = checksum or sha1(content).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(content), self.organization)
        chunks = chunks or [blob.checksum]

        assemble_preprod_artifact_installable_app(
            org_id=org_id or self.organization.id,
            project_id=project_id or self.project.id,
            checksum=checksum,
            chunks=chunks,
            artifact_id=artifact_id or self.preprod_artifact.id,
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_INSTALLABLE_APP, project_id or self.project.id, checksum
        )
        delete_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_INSTALLABLE_APP, project_id or self.project.id, checksum
        )
        return status, details

    def test_assemble_preprod_artifact_installable_app_success(self) -> None:
        status, details = self._run_task_and_verify_status(b"test installable app content")

        assert status == ChunkFileState.OK
        assert details is None

        # Verify installable app file was created
        installable_files = File.objects.filter(type="preprod.file")
        assert len(installable_files) == 1
        assert installable_files[0].name.startswith("preprod-file-")

        # Verify PreprodArtifact was updated with installable app file ID
        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.installable_app_file_id == installable_files[0].id

    def test_assemble_preprod_artifact_installable_app_error_cases(self) -> None:
        # Test nonexistent artifact
        status, details = self._run_task_and_verify_status(
            b"nonexistent artifact", artifact_id=99999
        )
        assert status == ChunkFileState.ERROR

        # Test checksum mismatch
        status, details = self._run_task_and_verify_status(b"checksum mismatch", checksum="b" * 40)
        assert status == ChunkFileState.ERROR
        assert "checksum mismatch" in details

        # Test missing chunks
        status, details = self._run_task_and_verify_status(
            b"missing chunks", chunks=["nonexistent" + "1" * 32]
        )
        assert status == ChunkFileState.ERROR
        assert "Not all chunks available" in details

        # Test nonexistent org
        status, details = self._run_task_and_verify_status(b"nonexistent org", org_id=99999)
        assert status == ChunkFileState.ERROR

        # Test nonexistent project
        status, details = self._run_task_and_verify_status(b"nonexistent project", project_id=99999)
        assert status == ChunkFileState.ERROR

        # Verify PreprodArtifact was not updated for error cases
        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.installable_app_file_id is None


class AssemblePreprodArtifactSizeAnalysisTest(BaseAssembleTest):
    def setUp(self) -> None:
        super().setUp()
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project, state=PreprodArtifact.ArtifactState.UPLOADED
        )

    def _run_task_and_verify_status(
        self, content, checksum=None, chunks=None, artifact_id=None, org_id=None, project_id=None
    ):
        checksum = checksum or sha1(content).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(content), self.organization)
        chunks = chunks or [blob.checksum]

        assemble_preprod_artifact_size_analysis(
            org_id=org_id or self.organization.id,
            project_id=project_id or self.project.id,
            checksum=checksum,
            chunks=chunks,
            artifact_id=artifact_id or self.preprod_artifact.id,
        )

        status, details = get_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS, project_id or self.project.id, checksum
        )
        delete_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS, project_id or self.project.id, checksum
        )
        return status, details

    def test_assemble_preprod_artifact_size_analysis_success(self) -> None:
        status, details = self._run_task_and_verify_status(
            b'{"download_size": 1000, "install_size": 2000}'
        )

        assert status == ChunkFileState.OK
        assert details is None

        # Verify size analysis file and size metrics creation
        size_files = File.objects.filter(type="preprod.file")
        assert len(size_files) == 1
        assert size_files[0].name.startswith("preprod-file-")

        # Verify PreprodArtifactSizeMetrics record was created
        size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=self.preprod_artifact
        )
        assert len(size_metrics) == 1
        assert size_metrics[0].analysis_file_id == size_files[0].id
        assert size_metrics[0].state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        assert (
            size_metrics[0].metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )

    def test_assemble_preprod_artifact_size_analysis_update_existing(self) -> None:
        # Create an existing size metrics record
        existing_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        status, details = self._run_task_and_verify_status(
            b'{"download_size": 1000, "install_size": 2000}'
        )

        assert status == ChunkFileState.OK
        assert details is None

        # Verify size analysis file was created
        size_files = File.objects.filter(type="preprod.file")
        assert len(size_files) == 1
        assert size_files[0].name.startswith("preprod-file-")

        # Verify existing PreprodArtifactSizeMetrics record was updated (not created new)
        size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=self.preprod_artifact
        )
        assert len(size_metrics) == 1  # Should still be only 1 record
        assert size_metrics[0].id == existing_size_metrics.id  # Should be the same record
        assert size_metrics[0].analysis_file_id == size_files[0].id
        assert size_metrics[0].state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED

    def test_assemble_preprod_artifact_size_analysis_error_cases(self) -> None:
        # Test nonexistent artifact
        status, details = self._run_task_and_verify_status(
            b"nonexistent artifact", artifact_id=99999
        )
        assert status == ChunkFileState.ERROR

        # Test checksum mismatch
        status, details = self._run_task_and_verify_status(b"checksum mismatch", checksum="b" * 40)
        assert status == ChunkFileState.ERROR
        assert "checksum mismatch" in details

        # Test missing chunks
        status, details = self._run_task_and_verify_status(
            b"missing chunks", chunks=["nonexistent" + "1" * 32]
        )
        assert status == ChunkFileState.ERROR
        assert "Not all chunks available" in details

        # Test nonexistent org
        status, details = self._run_task_and_verify_status(b"nonexistent org", org_id=99999)
        assert status == ChunkFileState.ERROR

        # Test nonexistent project
        status, details = self._run_task_and_verify_status(b"nonexistent project", project_id=99999)
        assert status == ChunkFileState.ERROR

        # Verify no size metrics were created for error cases
        size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=self.preprod_artifact
        )
        assert len(size_metrics) == 0


class DetectExpiredPreprodArtifactsTest(TestCase):
    def test_detect_expired_preprod_artifacts_no_expired(self):
        """Test that no artifacts are marked as expired when none are expired"""
        recent_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

        recent_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=recent_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        another_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        another_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=another_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        recent_size_comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=recent_size_metric,
            base_size_analysis=another_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.PROCESSING,
        )

        detect_expired_preprod_artifacts()

        # Verify nothing changed
        recent_artifact.refresh_from_db()
        recent_size_metric.refresh_from_db()
        recent_size_comparison.refresh_from_db()

        assert recent_artifact.state == PreprodArtifact.ArtifactState.UPLOADED
        assert recent_size_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
        assert recent_size_comparison.state == PreprodArtifactSizeComparison.State.PROCESSING

    def test_detect_expired_preprod_artifacts_with_expired(self):
        """Test that expired artifacts are marked as failed"""
        current_time = timezone.now()
        old_time = current_time - timedelta(minutes=35)  # 35 minutes ago (expired)

        expired_uploading_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )
        PreprodArtifact.objects.filter(id=expired_uploading_artifact.id).update(
            date_updated=old_time
        )

        expired_uploaded_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )
        PreprodArtifact.objects.filter(id=expired_uploaded_artifact.id).update(
            date_updated=old_time
        )

        expired_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=expired_uploaded_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        PreprodArtifactSizeMetrics.objects.filter(id=expired_size_metric.id).update(
            date_updated=old_time
        )

        another_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        another_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=another_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        expired_size_comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=expired_size_metric,
            base_size_analysis=another_size_metric,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.PROCESSING,
        )
        PreprodArtifactSizeComparison.objects.filter(id=expired_size_comparison.id).update(
            date_updated=old_time
        )

        detect_expired_preprod_artifacts()

        # Verify expired items were marked as failed
        expired_uploading_artifact.refresh_from_db()
        expired_uploaded_artifact.refresh_from_db()
        expired_size_metric.refresh_from_db()
        expired_size_comparison.refresh_from_db()

        assert expired_uploading_artifact.state == PreprodArtifact.ArtifactState.FAILED
        assert (
            expired_uploading_artifact.error_code
            == PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_TIMEOUT
        )
        assert (
            expired_uploading_artifact.error_message
            and "30 minutes" in expired_uploading_artifact.error_message
        )

        assert expired_uploaded_artifact.state == PreprodArtifact.ArtifactState.FAILED
        assert (
            expired_uploaded_artifact.error_code
            == PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_TIMEOUT
        )
        assert (
            expired_uploaded_artifact.error_message
            and "30 minutes" in expired_uploaded_artifact.error_message
        )

        assert expired_size_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        assert expired_size_metric.error_code == PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT
        assert (
            expired_size_metric.error_message and "30 minutes" in expired_size_metric.error_message
        )

        assert expired_size_comparison.state == PreprodArtifactSizeComparison.State.FAILED
        assert expired_size_comparison.error_code == PreprodArtifactSizeComparison.ErrorCode.TIMEOUT
        assert (
            expired_size_comparison.error_message
            and "30 minutes" in expired_size_comparison.error_message
        )

    def test_detect_expired_preprod_artifacts_mixed_states(self):
        """Test that only artifacts in the right states are considered for expiration"""
        current_time = timezone.now()
        old_time = current_time - timedelta(minutes=35)  # 35 minutes ago (expired)

        uploading_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,  # Should expire
        )
        PreprodArtifact.objects.filter(id=uploading_artifact.id).update(date_updated=old_time)

        uploaded_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,  # Should expire
        )
        PreprodArtifact.objects.filter(id=uploaded_artifact.id).update(date_updated=old_time)

        processed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,  # Should NOT expire
        )
        PreprodArtifact.objects.filter(id=processed_artifact.id).update(date_updated=old_time)

        failed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.FAILED,  # Should NOT expire
        )
        PreprodArtifact.objects.filter(id=failed_artifact.id).update(date_updated=old_time)

        processing_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=uploaded_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,  # Should expire
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        PreprodArtifactSizeMetrics.objects.filter(id=processing_size_metric.id).update(
            date_updated=old_time
        )

        completed_size_metric = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=processed_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,  # Should NOT expire
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        PreprodArtifactSizeMetrics.objects.filter(id=completed_size_metric.id).update(
            date_updated=old_time
        )

        detect_expired_preprod_artifacts()

        uploading_artifact.refresh_from_db()
        uploaded_artifact.refresh_from_db()
        processed_artifact.refresh_from_db()
        failed_artifact.refresh_from_db()
        processing_size_metric.refresh_from_db()
        completed_size_metric.refresh_from_db()

        # Both UPLOADING and UPLOADED artifacts should be marked as failed
        assert uploading_artifact.state == PreprodArtifact.ArtifactState.FAILED
        assert uploaded_artifact.state == PreprodArtifact.ArtifactState.FAILED
        assert processed_artifact.state == PreprodArtifact.ArtifactState.PROCESSED
        assert failed_artifact.state == PreprodArtifact.ArtifactState.FAILED  # Was already failed

        # Only the PROCESSING size metric should be marked as failed
        assert processing_size_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        assert completed_size_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED

    def test_detect_expired_preprod_artifacts_boundary_time(self):
        """Test the 30-minute boundary for expiration"""
        current_time = timezone.now()
        exactly_30_min_ago = current_time - timedelta(minutes=30)
        just_under_30_min_ago = current_time - timedelta(minutes=29)  # More buffer
        just_over_30_min_ago = current_time - timedelta(minutes=31)  # More buffer

        exactly_30_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,  # Test UPLOADING state
        )
        PreprodArtifact.objects.filter(id=exactly_30_artifact.id).update(
            date_updated=exactly_30_min_ago
        )

        just_under_30_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )
        PreprodArtifact.objects.filter(id=just_under_30_artifact.id).update(
            date_updated=just_under_30_min_ago
        )

        just_over_30_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,  # Test UPLOADING state
        )
        PreprodArtifact.objects.filter(id=just_over_30_artifact.id).update(
            date_updated=just_over_30_min_ago
        )

        detect_expired_preprod_artifacts()

        exactly_30_artifact.refresh_from_db()
        just_under_30_artifact.refresh_from_db()
        just_over_30_artifact.refresh_from_db()

        # Only artifacts that are exactly 30 minutes or older should expire
        assert exactly_30_artifact.state == PreprodArtifact.ArtifactState.FAILED
        assert (
            just_under_30_artifact.state == PreprodArtifact.ArtifactState.UPLOADED
        )  # Still processing
        assert just_over_30_artifact.state == PreprodArtifact.ArtifactState.FAILED
