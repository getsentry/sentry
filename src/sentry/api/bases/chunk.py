from __future__ import absolute_import

from sentry.models import File, FileBlob, FileBlobOwner
from sentry.models.file import ChunkFileState, CHUNK_STATE_HEADER


class ChunkAssembleMixin(object):
    def _create_file_response(self, state, missing_chunks=[]):
        """
        Helper function to create response for assemble endpoint
        """
        return {
            'state': state,
            'missingChunks': missing_chunks
        }

    def _check_chunk_ownership(self, organization, file_blobs, chunks, file=None):
        # Check the ownership of these blobs with the org
        all_owned_blobs = FileBlobOwner.objects.filter(
            blob__in=file_blobs,
            organization=organization
        ).prefetch_related('blob').all()

        owned_blobs = []
        for owned_blob in all_owned_blobs:
            owned_blobs.append((owned_blob.blob.id, owned_blob.blob.checksum))

        # If the request does not contain any chunks for a file
        # we return nothing since this should never happen only
        # if the client sends an invalid request
        if len(chunks) == 0:
            return self._create_file_response(
                ChunkFileState.NOT_FOUND
            )
        # Only if this org already has the ownership of all blobs
        # and the count of chunks is the same as in the request
        # and the file already exists, we say this file is OK
        elif len(file_blobs) == len(owned_blobs) == len(chunks) and file is not None:
            return self._create_file_response(
                file.headers.get(CHUNK_STATE_HEADER, ChunkFileState.OK)
            )
        # If the length of owned and sent chunks is not the same
        # we return all missing blobs
        elif len(owned_blobs) != len(chunks):
            # Create a missing chunks array which we return as response
            # so the client knows which chunks to reupload
            missing_chunks = set(chunks)
            for blob in owned_blobs:
                if blob[1] in missing_chunks:
                    missing_chunks.discard(blob[1])
            # If we have any missing chunks at all, return it to the client
            # that we need them to assemble the file
            if len(missing_chunks) > 0:
                return self._create_file_response(
                    ChunkFileState.NOT_FOUND,
                    missing_chunks
                )

    def _check_file_blobs(self, organization, checksum, chunks):
        files = File.objects.filter(
            checksum=checksum
        ).prefetch_related('blobs').all()
        # If there is no file at all, we try to find chunks in the db and check
        # their ownership
        if len(files) == 0:
            file_blobs = FileBlob.objects.filter(
                checksum__in=chunks
            ).all()
            return (
                None,
                self._check_chunk_ownership(organization, file_blobs, chunks)
            )
        # It is possible to have multiple identical files in the DB for every
        # architecture inside a FatObject. We can safely assume here that if
        # there are multiple matching files, their blobs will be the same and
        # we only have to check ownership for one representative.
        files = list(files)
        file = files[0]

        # We need to fetch all blobs
        file_blobs = file.blobs.all()
        rv = self._check_chunk_ownership(organization, file_blobs, chunks, file)
        if rv is not None:
            return (files, rv)

        return (None, None)

    def _create_file_for_assembling(self, name, checksum, chunks):
        # If we have all chunks and the file wasn't found before
        # we create a new file here with the state CREATED
        # Note that this file only exsists while the assemble tasks run
        file = File.objects.create(
            name=name,
            checksum=checksum,
            type='chunked',
            headers={CHUNK_STATE_HEADER: ChunkFileState.CREATED}
        )

        # Load all FileBlobs from db since we can be sure here we already own all
        # chunks need to build the file
        file_blobs = FileBlob.objects.filter(
            checksum__in=chunks
        ).values_list('id', 'checksum')

        # We need to make sure the blobs are in the order in which
        # we received them from the request.
        # Otherwise it could happen that we assemble the file in the wrong order
        # and get an garbage file.
        file_blob_ids = [x[0] for x in sorted(
            file_blobs, key=lambda blob: chunks.index(blob[1])
        )]

        return (file, file_blob_ids)
