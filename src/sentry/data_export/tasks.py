from __future__ import absolute_import

import csv
import logging
import six
import tempfile

from hashlib import sha1

from celery.task import current
from celery.exceptions import MaxRetriesExceededError
from django.core.files.base import ContentFile
from django.db import transaction, IntegrityError

from sentry.models import (
    AssembleChecksumMismatch,
    DEFAULT_BLOB_SIZE,
    File,
    FileBlob,
    FileBlobIndex,
    MAX_FILE_SIZE,
)
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import capture_exception

from .base import ExportError, ExportQueryType, SNUBA_MAX_RESULTS
from .models import ExportedData, ExportedDataBlob
from .utils import convert_to_utf8, handle_snuba_errors
from .processors.discover import DiscoverProcessor
from .processors.issues_by_tag import IssuesByTagProcessor


logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.data_export.tasks.assemble_download",
    queue="data_export",
    default_retry_delay=30,
    max_retries=3,
)
def assemble_download(
    data_export_id,
    export_limit=1000000,
    batch_size=SNUBA_MAX_RESULTS,
    offset=0,
    bytes_written=0,
    environment_id=None,
    **kwargs
):
    try:
        if offset == 0:
            logger.info("dataexport.start", extra={"data_export_id": data_export_id})
            metrics.incr("dataexport.start", tags={"success": True}, sample_rate=1.0)
        logger.info("dataexport.run", extra={"data_export_id": data_export_id, "offset": offset})
        data_export = ExportedData.objects.get(id=data_export_id)
    except ExportedData.DoesNotExist as error:
        if offset == 0:
            metrics.incr("dataexport.start", tags={"success": False}, sample_rate=1.0)
        capture_exception(error)
        return

    try:
        # if there is an export limit, the last batch should only return up to the export limit
        if export_limit is not None:
            batch_size = min(batch_size, max(export_limit - offset, 0))

        # NOTE: the processors don't have an unified interface at the moment
        # so this function handles it for us
        headers, rows = get_processed(data_export, environment_id, batch_size, offset)

        # starting position for the next batch
        next_offset = offset + len(rows)

        with tempfile.TemporaryFile() as tf:
            writer = csv.DictWriter(tf, headers, extrasaction="ignore")
            if offset == 0:
                writer.writeheader()
            writer.writerows(rows)
            tf.seek(0)

            new_bytes_written = store_export_chunk_as_blob(data_export, bytes_written, tf)
            bytes_written += new_bytes_written
    except ExportError as error:
        return data_export.email_failure(message=six.text_type(error))
    except Exception as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.error(
            "dataexport.error: %s",
            six.text_type(error),
            extra={"query": data_export.payload, "org": data_export.organization_id},
        )
        capture_exception(error)

        try:
            current.retry()
        except MaxRetriesExceededError:
            return data_export.email_failure(message="Internal processing failure")
    else:
        if (
            rows
            and new_bytes_written
            and len(rows) >= batch_size
            and (export_limit is None or next_offset < export_limit)
        ):
            assemble_download.delay(
                data_export_id,
                export_limit=export_limit,
                batch_size=batch_size,
                offset=next_offset,
                bytes_written=bytes_written,
                environment_id=environment_id,
            )
        else:
            merge_export_blobs.delay(data_export_id)


def get_processed(data_export, environment_id, batch_size, offset):
    try:
        if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
            processor, processed = process_issues_by_tag(
                data_export, environment_id, batch_size, offset
            )

        elif data_export.query_type == ExportQueryType.DISCOVER:
            processor, processed = process_discover(data_export, environment_id, batch_size, offset)

        return processor.header_fields, processed
    except ExportError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise error


@handle_snuba_errors(logger)
def process_issues_by_tag(data_export, environment_id, limit, offset):
    payload = data_export.query_info
    processor = IssuesByTagProcessor(
        project_id=payload["project"][0],
        group_id=payload["group"],
        key=payload["key"],
        environment_id=environment_id,
    )
    gtv_list_unicode = processor.get_serialized_data(limit=limit, offset=offset)
    # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
    # See associated comment in './utils.py'
    gtv_list = convert_to_utf8(gtv_list_unicode)
    return processor, gtv_list


@handle_snuba_errors(logger)
def process_discover(data_export, environment_id, limit, offset):
    processor = DiscoverProcessor(
        discover_query=data_export.query_info, organization_id=data_export.organization_id,
    )
    raw_data_unicode = processor.data_fn(limit=limit, offset=offset)["data"]
    # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
    # See associated comment in './utils.py'
    raw_data = convert_to_utf8(raw_data_unicode)
    raw_data = processor.handle_fields(raw_data)
    return processor, raw_data


@transaction.atomic()
def store_export_chunk_as_blob(data_export, bytes_written, fileobj, blob_size=DEFAULT_BLOB_SIZE):
    # adapted from `putfile` in  `src/sentry/models/file.py`
    bytes_offset = 0
    while True:
        contents = fileobj.read(blob_size)
        if not contents:
            return bytes_offset

        blob_fileobj = ContentFile(contents)
        blob = FileBlob.from_file(blob_fileobj, logger=logger)
        ExportedDataBlob.objects.create(
            data_export=data_export, blob=blob, offset=bytes_written + bytes_offset
        )

        bytes_offset += blob.size

        # there is a maximum file size allowed, so we need to make sure we don't exceed it
        if bytes_written + bytes_offset >= MAX_FILE_SIZE:
            transaction.set_rollback(True)
            return 0


@instrumented_task(name="sentry.data_export.tasks.merge_blobs", queue="data_export")
def merge_export_blobs(data_export_id, **kwargs):
    try:
        data_export = ExportedData.objects.get(id=data_export_id)
    except ExportedData.DoesNotExist as error:
        capture_exception(error)
        return

    # adapted from `putfile` in  `src/sentry/models/file.py`
    try:
        with transaction.atomic():
            file = File.objects.create(
                name=data_export.file_name, type="export.csv", headers={"Content-Type": "text/csv"},
            )
            size = 0
            file_checksum = sha1(b"")

            for export_blob in ExportedDataBlob.objects.filter(data_export=data_export).order_by(
                "offset"
            ):
                blob = export_blob.blob
                FileBlobIndex.objects.create(file=file, blob=blob, offset=size)
                size += blob.size
                blob_checksum = sha1(b"")

                for chunk in blob.getfile().chunks():
                    blob_checksum.update(chunk)
                    file_checksum.update(chunk)

                if blob.checksum != blob_checksum.hexdigest():
                    raise AssembleChecksumMismatch("Checksum mismatch")

            file.size = size
            file.checksum = file_checksum.hexdigest()
            data_export.finalize_upload(file=file)

            logger.info("dataexport.end", extra={"data_export_id": data_export_id})
            metrics.incr("dataexport.end", sample_rate=1.0)
    except Exception as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.error(
            "dataexport.error: %s",
            six.text_type(error),
            extra={"query": data_export.payload, "org": data_export.organization_id},
        )
        capture_exception(error)
        if isinstance(error, IntegrityError):
            message = "Failed to save the assembled file."
        else:
            message = "Internal processing failure."
        return data_export.email_failure(message=message)
