from __future__ import absolute_import

import os
import io
from hashlib import sha1

from django.core.files.base import ContentFile

from six.moves import xrange

from sentry.testutils import TestCase
from sentry.tasks.assemble import (
    assemble_artifacts,
    assemble_dif,
    assemble_file,
    get_assemble_status,
    AssembleTask,
    ChunkFileState,
)
from sentry.models import FileBlob, FileBlobOwner, ReleaseFile
from sentry.models.debugfile import ProjectDebugFile


class BaseAssembleTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="foo"
        )


class AssembleDifTest(BaseAssembleTest):
    def test_wrong_dif(self):
        content1 = "foo".encode("utf-8")
        fileobj1 = ContentFile(content1)

        content2 = "bar".encode("utf-8")
        fileobj2 = ContentFile(content2)

        content3 = "baz".encode("utf-8")
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
        for _ in xrange(8):
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
            FileBlobOwner.objects.filter(blob=blob, organization=self.organization).get()

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
        for _ in xrange(8):
            file_checksum.update(blob)
            files.append((io.BytesIO(blob), hash))

        # upload all blobs
        FileBlob.from_files(files, organization=self.organization)

        # find all blobs
        for reference, checksum in files:
            blob = FileBlob.objects.get(checksum=checksum)
            ref_bytes = reference.getvalue()
            assert blob.getfile().read(len(ref_bytes)) == ref_bytes
            FileBlobOwner.objects.filter(blob=blob, organization=self.organization).get()

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
        super(AssembleArtifactsTest, self).setUp()
        self.release = self.create_release(version="my-unique-release.1")

    def test_artifacts(self):
        bundle_file = self.create_artifact_bundle()
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
        assert status == ChunkFileState.OK
        assert details is None

        release_file = ReleaseFile.objects.get(
            organization=self.organization, release=self.release, name="~/index.js", dist=None
        )

        assert release_file
        assert release_file.file.headers == {"Sourcemap": "index.js.map"}

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
