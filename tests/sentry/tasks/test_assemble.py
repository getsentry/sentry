import io
import os
from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile

from sentry.models import FileBlob, FileBlobOwner, ReleaseFile
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.file import File
from sentry.models.releasefile import ReleaseArchive
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    _merge_archives,
    assemble_artifacts,
    assemble_dif,
    assemble_file,
    get_assemble_status,
)
from sentry.testutils import TestCase
from sentry.utils.locking import UnableToAcquireLock


class BaseAssembleTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="foo"
        )


class AssembleDifTest(BaseAssembleTest):
    def test_wrong_dif(self):
        content1 = b"foo"
        fileobj1 = ContentFile(content1)

        content2 = b"bar"
        fileobj2 = ContentFile(content2)

        content3 = b"baz"
        fileobj3 = ContentFile(content3)

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        blob1 = FileBlob.from_file(fileobj1)
        blob3 = FileBlob.from_file(fileobj3)
        blob2 = FileBlob.from_file(fileobj2)

        chunks = [blob2.checksum, blob1.checksum, blob3.checksum]

        assemble_dif(
            project_id=self.project.id, name="foo.sym", checksum=total_checksum, chunks=chunks
        )

        status, _ = get_assemble_status(AssembleTask.DIF, self.project.id, total_checksum)
        assert status == ChunkFileState.ERROR

    def test_dif(self):
        sym_file = self.load_fixture("crash.sym")
        blob1 = FileBlob.from_file(ContentFile(sym_file))
        total_checksum = sha1(sym_file).hexdigest()

        assemble_dif(
            project_id=self.project.id,
            name="crash.sym",
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        status, _ = get_assemble_status(AssembleTask.DIF, self.project.id, total_checksum)
        assert status == ChunkFileState.OK

        dif = ProjectDebugFile.objects.filter(project=self.project, checksum=total_checksum).get()

        assert dif.file.headers == {"Content-Type": "text/x-breakpad"}

    def test_assemble_from_files(self):
        files = []
        file_checksum = sha1()
        for _ in range(8):
            blob = os.urandom(1024 * 1024 * 8)
            hash = sha1(blob).hexdigest()
            file_checksum.update(blob)
            files.append((io.BytesIO(blob), hash))

        # upload all blobs
        FileBlob.from_files(files, organization=self.organization)

        # find all blobs
        for reference, checksum in files:
            blob = FileBlob.objects.get(checksum=checksum)
            ref_bytes = reference.getvalue()
            assert blob.getfile().read(len(ref_bytes)) == ref_bytes
            FileBlobOwner.objects.filter(blob=blob, organization_id=self.organization.id).get()

        rv = assemble_file(
            AssembleTask.DIF,
            self.project,
            "testfile",
            file_checksum.hexdigest(),
            [x[1] for x in files],
            "dummy.type",
        )

        assert rv is not None
        f, tmp = rv
        assert f.checksum == file_checksum.hexdigest()
        assert f.type == "dummy.type"

        # upload all blobs a second time
        for f, _ in files:
            f.seek(0)
        FileBlob.from_files(files, organization=self.organization)

        # assemble a second time
        f = assemble_file(
            AssembleTask.DIF,
            self.project,
            "testfile",
            file_checksum.hexdigest(),
            [x[1] for x in files],
            "dummy.type",
        )[0]
        assert f.checksum == file_checksum.hexdigest()

    def test_assemble_duplicate_blobs(self):
        files = []
        file_checksum = sha1()
        blob = os.urandom(1024 * 1024 * 8)
        hash = sha1(blob).hexdigest()
        for _ in range(8):
            file_checksum.update(blob)
            files.append((io.BytesIO(blob), hash))

        # upload all blobs
        FileBlob.from_files(files, organization=self.organization)

        # find all blobs
        for reference, checksum in files:
            blob = FileBlob.objects.get(checksum=checksum)
            ref_bytes = reference.getvalue()
            assert blob.getfile().read(len(ref_bytes)) == ref_bytes
            FileBlobOwner.objects.filter(blob=blob, organization_id=self.organization.id).get()

        rv = assemble_file(
            AssembleTask.DIF,
            self.project,
            "testfile",
            file_checksum.hexdigest(),
            [x[1] for x in files],
            "dummy.type",
        )

        assert rv is not None
        f, tmp = rv
        assert f.checksum == file_checksum.hexdigest()
        assert f.type == "dummy.type"

    def test_assemble_debug_id_override(self):
        sym_file = self.load_fixture("crash.sym")
        blob1 = FileBlob.from_file(ContentFile(sym_file))
        total_checksum = sha1(sym_file).hexdigest()

        assemble_dif(
            project_id=self.project.id,
            name="crash.sym",
            checksum=total_checksum,
            chunks=[blob1.checksum],
            debug_id="67e9247c-814e-392b-a027-dbde6748fcbf-beef",
        )

        status, _ = get_assemble_status(AssembleTask.DIF, self.project.id, total_checksum)
        assert status == ChunkFileState.OK

        dif = ProjectDebugFile.objects.filter(project=self.project, checksum=total_checksum).get()

        assert dif.file.headers == {"Content-Type": "text/x-breakpad"}
        assert dif.debug_id == "67e9247c-814e-392b-a027-dbde6748fcbf-beef"


class AssembleArtifactsTest(BaseAssembleTest):
    def setUp(self):
        super().setUp()
        self.release = self.create_release(version="my-unique-release.1")

    def test_artifacts(self):
        bundle_file = self.create_artifact_bundle()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        for has_release_archives in (True, False):
            with self.options(
                {
                    "processing.save-release-archives": has_release_archives,
                    "processing.release-archive-min-size": 1,
                }
            ):

                assemble_artifacts(
                    org_id=self.organization.id,
                    version=self.release.version,
                    checksum=total_checksum,
                    chunks=[blob1.checksum],
                )

                status, details = get_assemble_status(
                    AssembleTask.ARTIFACTS, self.organization.id, total_checksum
                )
                assert status == ChunkFileState.OK
                assert details is None

                release_file = ReleaseFile.objects.get(
                    organization=self.organization,
                    release=self.release,
                    name="release-artifacts.zip" if has_release_archives else "~/index.js",
                    dist=None,
                )

                assert release_file

                if has_release_archives:
                    assert release_file.file.headers == {}
                    # Artifact is the same as original bundle
                    assert release_file.file.size == len(bundle_file)
                else:
                    assert release_file.file.headers == {"Sourcemap": "index.js.map"}

    def test_merge_archives(self):
        file1 = File.objects.create()
        file1.putfile(ContentFile(self.create_artifact_bundle()))
        file2 = File.objects.create()
        file2.putfile(ContentFile(self.create_artifact_bundle()))

        release_file = ReleaseFile.objects.create(
            organization=self.organization,
            release=self.release,
            file=file1,
        )

        with ReleaseArchive(file2.getfile().file) as archive2:
            _merge_archives(release_file, file2, archive2)
            # Both files have disappeared, a new one has taken their place:
            assert not File.objects.filter(pk=file1.pk).exists()
            assert not File.objects.filter(pk=file2.pk).exists()
            assert release_file.file.pk > 2

    @patch("sentry.utils.locking.lock.Lock.blocking_acquire", side_effect=UnableToAcquireLock)
    @patch("sentry.tasks.assemble.logger.error")
    def test_merge_archives_fail(self, mock_log_error, _):
        file1 = File.objects.create()
        file1.putfile(ContentFile(self.create_artifact_bundle()))
        file2 = File.objects.create()
        file2.putfile(ContentFile(self.create_artifact_bundle()))

        release_file = ReleaseFile.objects.create(
            organization=self.organization,
            release=self.release,
            file=file1,
        )

        with ReleaseArchive(file2.getfile().file) as archive2:

            _merge_archives(release_file, file2, archive2)
            # Failed to update
            assert File.objects.filter(pk=file1.pk).exists()
            assert ReleaseFile.objects.get(pk=release_file.pk).file == file1
            assert not File.objects.filter(pk=file2.pk).exists()

            assert mock_log_error.called_with("merge_archives.fail")

    def test_artifacts_invalid_org(self):
        bundle_file = self.create_artifact_bundle(org="invalid")
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.ARTIFACTS, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR

    def test_artifacts_invalid_release(self):
        bundle_file = self.create_artifact_bundle(release="invalid")
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.ARTIFACTS, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR

    def test_artifacts_invalid_zip(self):
        bundle_file = b""
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        status, details = get_assemble_status(
            AssembleTask.ARTIFACTS, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR
