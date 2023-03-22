import io
import os
from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile

from sentry.models import FileBlob, FileBlobOwner, ReleaseFile
from sentry.models.artifactbundle import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.releasefile import read_artifact_index
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    assemble_artifacts,
    assemble_dif,
    assemble_file,
    get_assemble_status,
)
from sentry.testutils import TestCase


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

        dif = ProjectDebugFile.objects.filter(
            project_id=self.project.id, checksum=total_checksum
        ).get()

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
            with blob.getfile() as f:
                assert f.read(len(ref_bytes)) == ref_bytes
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
        tmp.close()
        assert f.checksum == file_checksum.hexdigest()
        assert f.type == "dummy.type"

        # upload all blobs a second time
        for f, _ in files:
            f.seek(0)
        FileBlob.from_files(files, organization=self.organization)

        # assemble a second time
        f, tmp = assemble_file(
            AssembleTask.DIF,
            self.project,
            "testfile",
            file_checksum.hexdigest(),
            [x[1] for x in files],
            "dummy.type",
        )
        tmp.close()
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
            with blob.getfile() as f:
                assert f.read(len(ref_bytes)) == ref_bytes
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
        tmp.close()
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

        dif = ProjectDebugFile.objects.filter(
            project_id=self.project.id, checksum=total_checksum
        ).get()

        assert dif.file.headers == {"Content-Type": "text/x-breakpad"}
        assert dif.debug_id == "67e9247c-814e-392b-a027-dbde6748fcbf-beef"


class AssembleArtifactsTest(BaseAssembleTest):
    def setUp(self):
        super().setUp()

    def test_artifacts_with_debug_ids(self):
        bundle_file = self.create_artifact_bundle_zip(
            fixture_path="artifact_bundle_debug_ids", project=self.project.id
        )
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        expected_source_file_types = [SourceFileType.MINIFIED_SOURCE, SourceFileType.SOURCE_MAP]
        expected_debug_ids = ["eb6e60f1-65ff-4f6f-adff-f1bbeded627b"]

        for version, dist, count in [
            (None, None, 0),
            ("1.0", None, 1),
            (None, "android", 0),
            ("1.0", "android", 1),
        ]:
            assemble_artifacts(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                version=version,
                dist=version,
                checksum=total_checksum,
                chunks=[blob1.checksum],
                upload_as_artifact_bundle=True,
            )

            assert self.release.count_artifacts() == 0

            status, details = get_assemble_status(
                AssembleTask.ARTIFACTS, self.organization.id, total_checksum
            )
            assert status == ChunkFileState.OK
            assert details is None

            for debug_id in expected_debug_ids:
                debug_id_artifact_bundles = DebugIdArtifactBundle.objects.filter(
                    organization_id=self.organization.id, debug_id=debug_id
                )
                assert len(debug_id_artifact_bundles) == 2
                assert debug_id_artifact_bundles[0].artifact_bundle.file.size == len(bundle_file)
                # We check if the bundle to which each debug id entry is connected has the correct bundle_id.
                for entry in debug_id_artifact_bundles:
                    assert (
                        str(entry.artifact_bundle.bundle_id)
                        == "67429b2f-1d9e-43bb-a626-771a1e37555c"
                    )
                # We check also if the source file types are equal.
                for index, entry in enumerate(debug_id_artifact_bundles):
                    assert entry.source_file_type == expected_source_file_types[index].value

                release_artifact_bundle = ReleaseArtifactBundle.objects.filter(
                    organization_id=self.organization.id
                )
                assert len(release_artifact_bundle) == count
                if count == 1:
                    release_artifact_bundle[0].version_name = version
                    release_artifact_bundle[0].dist_name = dist

                project_artifact_bundles = ProjectArtifactBundle.objects.filter(
                    project_id=self.project.id
                )
                assert len(project_artifact_bundles) == 1

            # We delete the newly create data from all the tables.
            ArtifactBundle.objects.all().delete()
            DebugIdArtifactBundle.objects.all().delete()
            ReleaseArtifactBundle.objects.all().delete()
            ProjectArtifactBundle.objects.all().delete()

    def test_artifacts_without_debug_ids(self):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        for min_files in (10, 1):
            with self.options(
                {
                    "processing.release-archive-min-files": min_files,
                }
            ):
                ReleaseFile.objects.filter(release_id=self.release.id).delete()

                assert self.release.count_artifacts() == 0

                assemble_artifacts(
                    org_id=self.organization.id,
                    version=self.release.version,
                    checksum=total_checksum,
                    chunks=[blob1.checksum],
                    upload_as_artifact_bundle=False,
                )

                assert self.release.count_artifacts() == 2

                status, details = get_assemble_status(
                    AssembleTask.ARTIFACTS, self.organization.id, total_checksum
                )
                assert status == ChunkFileState.OK
                assert details is None

                if min_files == 1:
                    # An archive was saved
                    index = read_artifact_index(self.release, dist=None)
                    archive_ident = index["files"]["~/index.js"]["archive_ident"]
                    releasefile = ReleaseFile.objects.get(
                        release_id=self.release.id, ident=archive_ident
                    )
                    # Artifact is the same as original bundle
                    assert releasefile.file.size == len(bundle_file)
                else:
                    # Individual files were saved
                    release_file = ReleaseFile.objects.get(
                        organization_id=self.organization.id,
                        release_id=self.release.id,
                        name="~/index.js",
                        dist_id=None,
                    )
                    assert release_file.file.headers == {"Sourcemap": "index.js.map"}

    def test_artifacts_invalid_org(self):
        bundle_file = self.create_artifact_bundle_zip(org="invalid", release=self.release.version)
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            upload_as_artifact_bundle=False,
        )

        status, details = get_assemble_status(
            AssembleTask.ARTIFACTS, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR

    def test_artifacts_invalid_release(self):
        bundle_file = self.create_artifact_bundle_zip(org=self.organization.slug, release="invalid")
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            upload_as_artifact_bundle=False,
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
            upload_as_artifact_bundle=False,
        )

        status, details = get_assemble_status(
            AssembleTask.ARTIFACTS, self.organization.id, total_checksum
        )
        assert status == ChunkFileState.ERROR

    @patch("sentry.tasks.assemble.update_artifact_index", side_effect=RuntimeError("foo"))
    def test_failing_update(self, _):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        total_checksum = sha1(bundle_file).hexdigest()

        with self.options(
            {
                "processing.save-release-archives": True,
                "processing.release-archive-min-files": 1,
            }
        ):
            assemble_artifacts(
                org_id=self.organization.id,
                version=self.release.version,
                checksum=total_checksum,
                chunks=[blob1.checksum],
                upload_as_artifact_bundle=False,
            )

            # Status is still OK:
            status, details = get_assemble_status(
                AssembleTask.ARTIFACTS, self.organization.id, total_checksum
            )
            assert status == ChunkFileState.OK
