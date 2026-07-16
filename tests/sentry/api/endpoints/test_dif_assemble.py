from hashlib import sha1
from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    assemble_dif,
    assemble_file,
    get_assemble_status,
    set_assemble_status,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.objectstore import debug_files_test_both_backends
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_objectstore


@debug_files_test_both_backends
class DifAssembleEndpoint(APITestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="foo"
        )
        self.url = reverse(
            "sentry-api-0-assemble-dif-files", args=[self.organization.slug, self.project.slug]
        )

    def test_assemble_json_schema(self) -> None:
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={checksum: "test"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url, data={checksum: {}}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={checksum: {"name": "dif", "chunks": []}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.NOT_FOUND

    def test_assemble_rejects_invalid_debug_id(self) -> None:
        checksum = sha1(b"1").hexdigest()

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    "name": "dif",
                    "debug_id": "invalid-debug-id",
                    "chunks": [],
                }
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 400, response.content
        assert response.data["error"] == "'invalid-debug-id' does not match '^[A-Fa-f0-9-]+$'"

    def test_assemble_check(self) -> None:
        content = b"foo bar"
        fileobj = ContentFile(content)
        file1 = File.objects.create(name="baz.dSYM", type="default", size=7)
        file1.putfile(fileobj, 3)
        checksum = sha1(content).hexdigest()

        blobs = FileBlob.objects.all()
        checksums = []
        for blob in blobs:
            checksums.append(blob.checksum)

        # Request to see of file is there
        # file exists but we have no overship for the chunks
        response = self.client.post(
            self.url,
            data={checksum: {"name": "dif", "chunks": checksums}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.NOT_FOUND
        assert set(response.data[checksum]["missingChunks"]) == set(checksums)

        # Now we add ownership to the blob
        blobs = FileBlob.objects.all()
        for blob in blobs:
            FileBlobOwner.objects.create(blob=blob, organization_id=self.organization.id)

        # The request will start the job to assemble the file
        response = self.client.post(
            self.url,
            data={checksum: {"name": "dif", "chunks": checksums}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.CREATED
        assert response.data[checksum]["missingChunks"] == []

        # Finally, we simulate a successful job
        ProjectDebugFile.objects.create(
            file=file1,
            checksum=file1.checksum,
            object_name="baz.dSYM",
            cpu_name="x86_64",
            project_id=self.project.id,
            debug_id="df449af8-0dcd-4320-9943-ec192134d593",
            code_id="DF449AF80DCD43209943EC192134D593",
        )
        set_assemble_status(AssembleTask.DIF, self.project.id, checksum, None)

        # Request now tells us that everything is alright
        response = self.client.post(
            self.url,
            data={checksum: {"name": "dif", "chunks": checksums}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.OK
        assert response.data[checksum]["missingChunks"] == []

        not_found_checksum = sha1(b"1").hexdigest()

        response = self.client.post(
            self.url,
            data={not_found_checksum: {"name": "dif", "chunks": [not_found_checksum]}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[not_found_checksum]["state"] == ChunkFileState.NOT_FOUND
        assert set(response.data[not_found_checksum]["missingChunks"]) == {not_found_checksum}

    @patch("sentry.tasks.assemble.assemble_dif")
    def test_assemble(self, mock_assemble_dif: MagicMock) -> None:
        content1 = b"foo"
        fileobj1 = ContentFile(content1)
        checksum1 = sha1(content1).hexdigest()

        content2 = b"bar"
        fileobj2 = ContentFile(content2)
        checksum2 = sha1(content2).hexdigest()

        content3 = b"baz"
        fileobj3 = ContentFile(content3)
        checksum3 = sha1(content3).hexdigest()

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        blob1 = FileBlob.from_file(fileobj1)
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)
        blob3 = FileBlob.from_file(fileobj3)
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob3)
        blob2 = FileBlob.from_file(fileobj2)

        # we make a request now but we are missing ownership for chunk 2
        response = self.client.post(
            self.url,
            data={total_checksum: {"name": "test", "chunks": [checksum2, checksum1, checksum3]}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]["state"] == ChunkFileState.NOT_FOUND
        assert response.data[total_checksum]["missingChunks"] == [checksum2]

        # we add ownership to chunk 2
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob2)

        # new request, ownership for all chunks is there but file does not exist yet
        response = self.client.post(
            self.url,
            data={total_checksum: {"name": "test", "chunks": [checksum2, checksum1, checksum3]}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]["state"] == ChunkFileState.CREATED
        assert response.data[total_checksum]["missingChunks"] == []

        chunks = [checksum2, checksum1, checksum3]
        mock_assemble_dif.apply_async.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "name": "test",
                "chunks": chunks,
                "checksum": total_checksum,
                "debug_id": None,
            }
        )

        assemble_result = assemble_file(
            AssembleTask.DIF, self.project, "test", total_checksum, chunks, "project.dif"
        )

        assert assemble_result is not None

        file = assemble_result.bundle
        status, _ = get_assemble_status(AssembleTask.DIF, self.project.id, total_checksum)
        assert status != ChunkFileState.ERROR
        assert file.checksum == total_checksum

        file_blob_index = FileBlobIndex.objects.all()
        assert len(file_blob_index) == 3

    def test_dif_response(self) -> None:
        sym_file = self.load_fixture("crash.sym")
        blob1 = FileBlob.from_file_with_organization(ContentFile(sym_file), self.organization)
        total_checksum = sha1(sym_file).hexdigest()
        chunks = [blob1.checksum]

        assemble_dif(
            project_id=self.project.id, name="crash.sym", checksum=total_checksum, chunks=chunks
        )

        response = self.client.post(
            self.url,
            data={total_checksum: {"name": "test.sym", "chunks": chunks}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[total_checksum]["state"] == ChunkFileState.OK
        assert response.data[total_checksum]["dif"]["cpuName"] == "x86_64"
        assert (
            response.data[total_checksum]["dif"]["uuid"] == "67e9247c-814e-392b-a027-dbde6748fcbf"
        )

    def test_dif_error_response(self) -> None:
        sym_file = b"fail"
        blob1 = FileBlob.from_file_with_organization(ContentFile(sym_file), self.organization)
        total_checksum = sha1(sym_file).hexdigest()
        chunks = [blob1.checksum]

        assemble_dif(
            project_id=self.project.id, name="test.sym", checksum=total_checksum, chunks=chunks
        )

        response = self.client.post(
            self.url,
            data={total_checksum: {"name": "test.sym", "chunks": []}},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[total_checksum]["state"] == ChunkFileState.ERROR
        assert "unsupported object file format" in response.data[total_checksum]["detail"]

    def test_reuses_existing_proguard_file_with_new_debug_id(self) -> None:
        file_contents = b"proguard mapping"
        checksum = sha1(file_contents).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(file_contents), self.organization)
        chunks = [blob.checksum]

        assemble_dif(
            project_id=self.project.id,
            name="/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            checksum=checksum,
            chunks=chunks,
        )

        first_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="00000000-0000-0000-0000-000000000000",
        )

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    "name": "/proguard/mapping-11111111-1111-1111-1111-111111111111.txt",
                    "chunks": chunks,
                }
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.OK
        assert response.data[checksum]["dif"]["uuid"] == "11111111-1111-1111-1111-111111111111"

        second_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="11111111-1111-1111-1111-111111111111",
        )

        if first_dif.storage_path is not None:
            assert first_dif.storage_path != second_dif.storage_path
        else:
            assert first_dif.file_id == second_dif.file_id
        assert File.objects.filter(type="project.dif", checksum=checksum).count() <= 1

    def test_reupload_proguard_with_same_debug_id_is_idempotent(self) -> None:
        file_contents = b"proguard mapping"
        checksum = sha1(file_contents).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(file_contents), self.organization)
        chunks = [blob.checksum]

        assemble_dif(
            project_id=self.project.id,
            name="/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            checksum=checksum,
            chunks=chunks,
        )

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    "name": "/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
                    "chunks": chunks,
                }
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.OK
        assert (
            ProjectDebugFile.objects.filter(
                project_id=self.project.id,
                debug_id="00000000-0000-0000-0000-000000000000",
            ).count()
            == 1
        )

    def test_proguard_reupload_errors_for_non_proguard_file(self) -> None:
        sym_file = self.load_fixture("crash.sym")
        checksum = sha1(sym_file).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(sym_file), self.organization)
        chunks = [blob.checksum]

        assemble_dif(
            project_id=self.project.id,
            name="crash.sym",
            checksum=checksum,
            chunks=chunks,
        )

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    "name": "/proguard/mapping-11111111-1111-1111-1111-111111111111.txt",
                    "chunks": chunks,
                }
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.ERROR
        assert response.data[checksum]["detail"] == "This file is not a ProGuard mapping."


@requires_objectstore
class DifAssembleProguardCloneBackendTransitionTest(APITestCase):
    """Cover ProGuard clone requests where the source row's backend differs from
    the active write backend, i.e. the rollout/rollback transition windows that
    `debug_files_test_both_backends` cannot reach (it ties source creation and
    the clone to the same flag state)."""

    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="foo"
        )
        self.url = reverse(
            "sentry-api-0-assemble-dif-files", args=[self.organization.slug, self.project.slug]
        )

    def _assemble_source(self, checksum: str, chunks: list[str]) -> None:
        assemble_dif(
            project_id=self.project.id,
            name="/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            checksum=checksum,
            chunks=chunks,
        )

    def _clone_request(self, checksum: str, chunks: list[str]):
        return self.client.post(
            self.url,
            data={
                checksum: {
                    "name": "/proguard/mapping-11111111-1111-1111-1111-111111111111.txt",
                    "chunks": chunks,
                }
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

    def test_clone_file_backed_source_to_objectstore(self) -> None:
        """A file-backed source (created before rollout) is cloned while the write flag is enabled, producing an Objectstore-backed clone."""

        file_contents = b"proguard mapping"
        checksum = sha1(file_contents).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(file_contents), self.organization)
        chunks = [blob.checksum]

        with self.feature({"organizations:objectstore-debugfiles-write": False}):
            self._assemble_source(checksum, chunks)

        first_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="00000000-0000-0000-0000-000000000000",
        )
        assert first_dif.file_id is not None
        assert first_dif.storage_path is None

        with self.feature({"organizations:objectstore-debugfiles-write": True}):
            response = self._clone_request(checksum, chunks)

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.OK
        assert response.data[checksum]["dif"]["uuid"] == "11111111-1111-1111-1111-111111111111"

        second_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="11111111-1111-1111-1111-111111111111",
        )
        # The source stays file-backed; the clone is written to both backends.
        assert second_dif.file_id is not None
        assert second_dif.storage_path is not None
        assert second_dif.get_file().read() == file_contents

    def test_clone_dual_written_source_to_file(self) -> None:
        """A dual-written source is cloned after the write flag is disabled, producing a file-backed clone."""

        file_contents = b"proguard mapping"
        checksum = sha1(file_contents).hexdigest()
        blob = FileBlob.from_file_with_organization(ContentFile(file_contents), self.organization)
        chunks = [blob.checksum]

        with self.feature({"organizations:objectstore-debugfiles-write": True}):
            self._assemble_source(checksum, chunks)

        first_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="00000000-0000-0000-0000-000000000000",
        )
        assert first_dif.file_id is not None
        assert first_dif.storage_path is not None

        with self.feature({"organizations:objectstore-debugfiles-write": False}):
            response = self._clone_request(checksum, chunks)

        assert response.status_code == 200, response.content
        assert response.data[checksum]["state"] == ChunkFileState.OK
        assert response.data[checksum]["dif"]["uuid"] == "11111111-1111-1111-1111-111111111111"

        second_dif = ProjectDebugFile.objects.get(
            project_id=self.project.id,
            debug_id="11111111-1111-1111-1111-111111111111",
        )
        # The source stays Objectstore-backed; the clone is written as a File.
        assert second_dif.file_id is not None
        assert second_dif.storage_path is None
        assert second_dif.get_file().read() == file_contents
