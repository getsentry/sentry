from __future__ import absolute_import, print_function

import logging

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.dif_chunks', queue='assemble')
def dif_chunks(type, file_id, file_blob_ids, checksum, **kwargs):
    '''type= ChunkAssembleType'''
    logger.warning('sentry.tasks.assemble.dif_chunks', extra={'file_blob_ids': file_blob_ids})
    from sentry.models import File
    from sentry.models.file import ChunkFileState, ChunkAssembleType
    file = File.objects.filter(
        id=file_id,
    ).get()
    file.headers['state'] = ChunkFileState.ASSEMBLING
    file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    if file.headers.get('state', '') == 'ERROR':
        logger.warning(
            'sentry.tasks.assemble.dif_chunks',
            extra={
                'error': file.headers.get('error', ''),
                'file_id': file.id
            }
        )
        return

    if type == ChunkAssembleType.DIF:
        from sentry.models import dsymfile
        with file.getfile(as_tempfile=True) as tf:
            result = dsymfile.detect_dif_from_filename(tf.name)
            if result:
                # TODO(hazat)
                pass
