from hashlib import sha1
from unittest.mock import patch

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
from sentry.testutils.silo import assume_test_silo_mode


class DifAssembleEndpoint(APITestCase):
    def setUp(self):
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

    def test_assemble_json_schema(self):
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

    def test_assemble_check(self):
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
    def test_assemble(self, mock_assemble_dif):
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

    def test_dif_response(self):
        sym_file = self.load_fixture("crash.sym")
        blob1 = FileBlob.from_file(ContentFile(sym_file))
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

    def test_dif_error_response(self):
        sym_file = b"fail"
        blob1 = FileBlob.from_file(ContentFile(sym_file))
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
