from __future__ import absolute_import, print_function

import six
import logging

from django.db import transaction
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.assemble_dif', queue='assemble')
def assemble_dif(project_id, file_id, file_blob_ids, checksum, **kwargs):
    with transaction.atomic():
        # Assemble the chunks into files
        file = assemble_chunks(file_id, file_blob_ids, checksum)

        from sentry.models import ChunkFileState, dsymfile, Project

        project = Project.objects.filter(
            id=project_id
        ).get()

        with file.getfile(as_tempfile=True) as tf:
            result = dsymfile.detect_dif_from_filename(tf.name)
            if result:
                dsyms = dsymfile.create_dsym_from_dif(result, project, file.name)

                from sentry.tasks.symcache_update import symcache_update
                uuids_to_update = [six.text_type(x.uuid) for x in dsyms
                                   if x.supports_symcache]
                if uuids_to_update:
                    symcache_update.delay(project_id=project.id,
                                          uuids=uuids_to_update)

                # Uploading new dsysm changes the reprocessing revision
                dsymfile.bump_reprocessing_revision(project)
                # We can delete the original chunk file since we created new dsym files
                file.delete()
            else:
                file.headers['state'] = ChunkFileState.ERROR
                file.headers['error'] = 'Invalid object file'
                file.save()
                logger.error(
                    'assemble_chunks.invalid_object_file',
                    extra={
                        'error': file.headers.get('error', ''),
                        'file_id': file.id
                    }
                )


def assemble_chunks(file_id, file_blob_ids, checksum, **kwargs):
    '''This assembles multiple chunks into on File.'''
    if len(file_blob_ids) == 0:
        logger.warning('assemble_chunks.empty_file_blobs', extra={
            'error': 'Empty file blobs'
        })

    from sentry.models import File, ChunkFileState

    file = File.objects.filter(
        id=file_id,
    ).get()

    file.headers['state'] = ChunkFileState.ASSEMBLING
    # Do the actual assembling here

    file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    if file.headers.get('state', '') == ChunkFileState.ERROR:
        logger.error(
            'assemble_chunks.assemble_error',
            extra={
                'error': file.headers.get('error', ''),
                'file_id': file.id
            }
        )
        return
    file.headers['state'] = ChunkFileState.OK
    file.save()
    return file
