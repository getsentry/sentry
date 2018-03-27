from __future__ import absolute_import, print_function

import os
import logging

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.assemble_dif', queue='assemble')
def assemble_dif(project_id, name, checksum, chunks, **kwargs):
    from sentry.models import ChunkFileState, dsymfile, Project, \
        ProjectDSymFile, set_assemble_status, BadDif
    from sentry.reprocessing import bump_reprocessing_revision

    project = Project.objects.filter(id=project_id).get()
    set_assemble_status(project, checksum, ChunkFileState.ASSEMBLING)

    # Assemble the chunks into files
    rv = assemble_file(project, name, checksum, chunks,
                       file_type='project.dsym')

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
                result = dsymfile.detect_dif_from_path(temp_file.name)
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

            dsym_type, cpu, file_id, filename = result[0]
            dsym, created = dsymfile.create_dsym_from_id(
                project, dsym_type, cpu, file_id,
                os.path.basename(name),
                file=file)
            delete_file = False
            bump_reprocessing_revision(project)

            indicate_success = True

            # If we need to write a symcache we can use the
            # `generate_symcache` method to attempt to write one.
            # This way we can also capture down the error if we need
            # to.
            if dsym.supports_symcache:
                symcache, error = ProjectDSymFile.dsymcache.generate_symcache(
                    project, dsym, temp_file)
                if error is not None:
                    set_assemble_status(project, checksum, ChunkFileState.ERROR,
                                        detail=error)
                    indicate_success = False

            if indicate_success:
                set_assemble_status(project, checksum, ChunkFileState.OK)
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
    ).values_list('id', 'checksum')

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
