from __future__ import absolute_import, print_function

import six
import logging

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.assemble_chunks', queue='assemble')
def assemble_chunks(type, params, file_id, file_blob_ids, checksum, **kwargs):
    '''type= ChunkAssembleType'''
    logger.warning('sentry.tasks.assemble.assemble_chunks', extra={'file_blob_ids': file_blob_ids})
    from sentry.models import File
    from sentry.models.file import ChunkFileState, ChunkAssembleType
    file = File.objects.filter(
        id=file_id,
    ).get()
    file.headers['state'] = ChunkFileState.ASSEMBLING
    file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    if file.headers.get('state', '') == 'ERROR':
        logger.warning(
            'sentry.tasks.assemble.assemble_chunks',
            extra={
                'error': file.headers.get('error', ''),
                'file_id': file.id
            }
        )
        return

    if type == ChunkAssembleType.DIF:
        assemble_dif(file, params)


def assemble_dif(file, params):
    from sentry.models.file import ChunkFileState
    project_slug = params.get('project', None)
    organization_slug = params.get('org', None)
    if project_slug is None or organization_slug is None:
        file.headers['state'] = ChunkFileState.ERROR
        file.headers['error'] = 'missing org/project'
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
            file.headers['error'] = 'invalid object file'
