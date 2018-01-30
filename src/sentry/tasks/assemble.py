from __future__ import absolute_import, print_function

import logging

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.assemble.dif_chunks', queue='assemble')
def dif_chunks(file_blob_ids, name, checksum, **kwargs):
    logger.warning('sentry.tasks.assemble.dif_chunks', extra={'file_blob_ids': file_blob_ids})
    from sentry.models import File
    file = File.objects.create(
        name=name,
        type='project.dsym',
        headers={'Content-Type': 'text/x-breakpad'},
    )
    file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    # TODO(hazat): Get file and detect file type
