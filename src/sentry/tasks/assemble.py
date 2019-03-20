from __future__ import absolute_import, print_function

import logging

from sentry.api.serializers import serialize
from sentry.tasks.base import instrumented_task
from sentry.utils.files import get_max_file_size
from sentry.utils.sdk import configure_scope

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.assemble_dif', queue='assemble')
def assemble_dif(project_id, name, checksum, chunks, **kwargs):
    from sentry.models import ChunkFileState, debugfile, Project, \
        ProjectDebugFile, set_assemble_status, BadDif
    from sentry.reprocessing import bump_reprocessing_revision

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    project = Project.objects.filter(id=project_id).get()
    set_assemble_status(project, checksum, ChunkFileState.ASSEMBLING)

    # Assemble the chunks into files
    rv = assemble_file(project, name, checksum, chunks,
                       file_type='project.dif')

    # If not file has been created this means that the file failed to
    # assemble because of bad input data.  Return.
    if rv is None:
        return

    file, temp_file = rv
    delete_file = True
    try:
        with temp_file:
            # We only permit split difs to hit this endpoint.  The
            # client is required to split them up first or we error.
            try:
                result = debugfile.detect_dif_from_path(temp_file.name, name=name)
            except BadDif as e:
                set_assemble_status(project, checksum, ChunkFileState.ERROR,
                                    detail=e.args[0])
                return

            if len(result) != 1:
                set_assemble_status(project, checksum, ChunkFileState.ERROR,
                                    detail='Contained wrong number of '
                                    'architectures (expected one, got %s)'
                                    % len(result))
                return

            dif, created = debugfile.create_dif_from_id(project, result[0], file=file)
            indicate_success = True
            delete_file = False

            if created:
                # Bump the reprocessing revision since the symbol has changed
                # and might resolve processing issues. If the file was not
                # created, someone else has created it and will bump the
                # revision instead.
                bump_reprocessing_revision(project)

                # Try to generate caches from this DIF immediately. If this
                # fails, we can capture the error and report it to the uploader.
                # Also, we remove the file to prevent it from erroring again.
                error = ProjectDebugFile.difcache.generate_caches(project, dif, temp_file.name)
                if error is not None:
                    set_assemble_status(project, checksum, ChunkFileState.ERROR,
                                        detail=error)
                    indicate_success = False
                    dif.delete()

            if indicate_success:
                set_assemble_status(project, checksum, ChunkFileState.OK,
                                    detail=serialize(dif))
    finally:
        if delete_file:
            file.delete()


def assemble_file(project, name, checksum, chunks, file_type):
    '''This assembles multiple chunks into on File.'''
    from sentry.models import File, ChunkFileState, AssembleChecksumMismatch, \
        FileBlob, set_assemble_status

    # Load all FileBlobs from db since we can be sure here we already own all
    # chunks need to build the file
    file_blobs = FileBlob.objects.filter(
        checksum__in=chunks
    ).values_list('id', 'checksum', 'size')

    # Reject all files that exceed the maximum allowed size for this
    # organization. This value cannot be
    file_size = sum(x[2] for x in file_blobs)
    if file_size > get_max_file_size(project.organization):
        set_assemble_status(project, checksum, ChunkFileState.ERROR,
                            detail='File exceeds maximum size')
        return

    # We need to make sure the blobs are in the order in which
    # we received them from the request.
    # Otherwise it could happen that we assemble the file in the wrong order
    # and get an garbage file.
    file_blob_ids = [x[0] for x in sorted(
        file_blobs, key=lambda blob: chunks.index(blob[1])
    )]

    # Sanity check.  In case not all blobs exist at this point we have a
    # race condition.
    if set(x[1] for x in file_blobs) != set(chunks):
        set_assemble_status(project, checksum, ChunkFileState.ERROR,
                            detail='Not all chunks available for assembling')
        return

    file = File.objects.create(
        name=name,
        checksum=checksum,
        type=file_type,
    )
    try:
        temp_file = file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    except AssembleChecksumMismatch:
        file.delete()
        set_assemble_status(project, checksum, ChunkFileState.ERROR,
                            detail='Reported checksum mismatch')
    else:
        file.save()
        return file, temp_file
