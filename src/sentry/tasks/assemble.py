from __future__ import absolute_import, print_function

import six
import logging

from django.db import transaction
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.assemble_chunks', queue='assemble')
def assemble_chunks(type, params, file_id, file_blob_ids, checksum, **kwargs):
    '''This assembles multiple chunks into on File.
    The type is a File.ChunkAssembleType
    '''
    if len(file_blob_ids) == 0:
        logger.warning('assemble_chunks.empty_file_blobs', extra={
            'error': 'Empty file blobs'
        })

    from sentry.models import File
    from sentry.models.file import ChunkFileState, ChunkAssembleType
    file = File.objects.filter(
        id=file_id,
    ).get()

    file.headers['state'] = ChunkFileState.ASSEMBLING
    # Do the actual assembling here
    with transaction.atomic():
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

        # Depending on the type, we want to do additional stuff
        # Default: Generic = Do nothing since the file is already assembled
        if type == ChunkAssembleType.DIF:
            # Assemble a dif here, we need to create Dsyms and symcache
            assemble_dif(file, params)
        else:
            file.headers['state'] = ChunkFileState.OK
            file.save()


def assemble_dif(file, params):
    from sentry.models.file import ChunkFileState
    project_slug = params.get('project', None)
    organization_slug = params.get('org', None)
    if project_slug is None or organization_slug is None:
        file.headers['state'] = ChunkFileState.ERROR
        file.headers['error'] = 'Missing org/project'
        logger.error(
            'assemble_chunks.missing_params',
            extra={
                'error': file.headers.get('error', ''),
                'file_id': file.id
            }
        )
        return

    from sentry.models import dsymfile, Project

    project = Project.objects.filter(
        organization__slug=organization_slug,
        slug=project_slug,
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
            logger.error(
                'assemble_chunks.invalid_object_file',
                extra={
                    'error': file.headers.get('error', ''),
                    'file_id': file.id
                }
            )
