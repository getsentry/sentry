from __future__ import absolute_import

import csv
import logging
import six
import tempfile
import codecs

from hashlib import sha1

from celery.task import current
from celery.exceptions import MaxRetriesExceededError
from django.core.files.base import ContentFile
from django.db import transaction, IntegrityError
from django.utils import timezone

import sentry_sdk

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

from .base import (
    ExportError,
    ExportQueryType,
    EXPORTED_ROWS_LIMIT,
    SNUBA_MAX_RESULTS,
    MAX_BATCH_SIZE,
)
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
    acks_late=True,
)
def assemble_download(
    data_export_id,
    export_limit=EXPORTED_ROWS_LIMIT,
    batch_size=SNUBA_MAX_RESULTS,
    offset=0,
    bytes_written=0,
    environment_id=None,
    **kwargs
):
    with sentry_sdk.start_transaction(
        op="task.data_export.assemble", name="DataExportAssemble", sampled=True,
    ):
        first_page = offset == 0

        try:
            if first_page:
                logger.info("dataexport.start", extra={"data_export_id": data_export_id})
            data_export = ExportedData.objects.get(id=data_export_id)
            if first_page:
                metrics.incr("dataexport.start", tags={"success": True}, sample_rate=1.0)
            logger.info(
                "dataexport.run", extra={"data_export_id": data_export_id, "offset": offset}
            )
        except ExportedData.DoesNotExist as error:
            if first_page:
                metrics.incr("dataexport.start", tags={"success": False}, sample_rate=1.0)
            logger.exception(error)
            return

        with sentry_sdk.configure_scope() as scope:
            if data_export.user:
                user = {}
                if data_export.user.id:
                    user["id"] = data_export.user.id
                if data_export.user.username:
                    user["username"] = data_export.user.username
                if data_export.user.email:
                    user["email"] = data_export.user.email
                scope.user = user
            scope.set_tag("organization.slug", data_export.organization.slug)
            scope.set_tag("export.type", ExportQueryType.as_str(data_export.query_type))
            scope.set_extra("export.query", data_export.query_info)

        try:
            # ensure that the export limit is set and capped at EXPORTED_ROWS_LIMIT
            if export_limit is None:
                export_limit = EXPORTED_ROWS_LIMIT
            else:
                export_limit = min(export_limit, EXPORTED_ROWS_LIMIT)

            processor = get_processor(data_export, environment_id)

            with tempfile.TemporaryFile(mode="w+b") as tf:
                # XXX(python3):
                #
                # In python2 land we write utf-8 encoded strings as bytes via
                # the csv writer (see convert_to_utf8). The CSV writer will
                # ONLY write bytes, even if you give it unicode it will convert
                # it to bytes.
                #
                # In python3 we write unicode strings (which is all the csv
                # module is able to do, it will NOT write bytes like in py2).
                # Because of this we use the codec getwriter to transform our
                # file handle to a stream writer that will encode to utf8.
                if six.PY2:
                    tfw = tf
                else:
                    tfw = codecs.getwriter("utf-8")(tf)

                writer = csv.DictWriter(tfw, processor.header_fields, extrasaction="ignore")
                if first_page:
                    writer.writeheader()

                # the position in the file at the end of the headers
                starting_pos = tf.tell()

                # the row offset relative to the start of the current task
                # this offset tells you the number of rows written during this batch fragment
                fragment_offset = 0

                # the absolute row offset from the beginning of the export
                next_offset = offset + fragment_offset

                while True:
                    # the number of rows to export in the next batch fragment
                    fragment_row_count = min(batch_size, max(export_limit - next_offset, 1))

                    rows = process_rows(processor, data_export, fragment_row_count, next_offset)
                    writer.writerows(rows)

                    fragment_offset += len(rows)
                    next_offset = offset + fragment_offset

                    if (
                        not rows
                        or len(rows) < batch_size
                        # the batch may exceed MAX_BATCH_SIZE but immediately stops
                        or tf.tell() - starting_pos >= MAX_BATCH_SIZE
                    ):
                        break

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
                metrics.incr(
                    "dataexport.end",
                    tags={"success": False, "error": six.text_type(error)},
                    sample_rate=1.0,
                )
                return data_export.email_failure(message="Internal processing failure")
        else:
            if (
                rows
                and len(rows) >= batch_size
                and new_bytes_written
                and next_offset < export_limit
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
                metrics.timing("dataexport.row_count", next_offset, sample_rate=1.0)
                metrics.timing("dataexport.file_size", bytes_written, sample_rate=1.0)
                merge_export_blobs.delay(data_export_id)


def get_processor(data_export, environment_id):
    try:
        if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
            payload = data_export.query_info
            processor = IssuesByTagProcessor(
                project_id=payload["project"][0],
                group_id=payload["group"],
                key=payload["key"],
                environment_id=environment_id,
            )
        elif data_export.query_type == ExportQueryType.DISCOVER:
            processor = DiscoverProcessor(
                discover_query=data_export.query_info, organization_id=data_export.organization_id,
            )
        return processor
    except ExportError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise


def process_rows(processor, data_export, batch_size, offset):
    try:
        if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
            rows = process_issues_by_tag(processor, batch_size, offset)
        elif data_export.query_type == ExportQueryType.DISCOVER:
            rows = process_discover(processor, batch_size, offset)
        return rows
    except ExportError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise


@handle_snuba_errors(logger)
def process_issues_by_tag(processor, limit, offset):
    gtv_list_unicode = processor.get_serialized_data(limit=limit, offset=offset)
    # TODO(python3): Remove next block once the 'csv' module has been updated
    # to Python 3
    if six.PY2:
        gtv_list = convert_to_utf8(gtv_list_unicode)
    else:
        gtv_list = gtv_list_unicode
    return gtv_list


@handle_snuba_errors(logger)
def process_discover(processor, limit, offset):
    raw_data_unicode = processor.data_fn(limit=limit, offset=offset)["data"]
    # TODO(python3): Remove next block once the 'csv' module has been updated
    # to Python 3
    if six.PY2:
        raw_data = convert_to_utf8(raw_data_unicode)
    else:
        raw_data = raw_data_unicode
    raw_data = processor.handle_fields(raw_data)
    return raw_data


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
        ExportedDataBlob.objects.get_or_create(
            data_export=data_export, blob=blob, offset=bytes_written + bytes_offset
        )

        bytes_offset += blob.size

        # there is a maximum file size allowed, so we need to make sure we don't exceed it
        # NOTE: there seems to be issues with downloading files larger than 1 GB on slower
        # networks, limit the export to 1 GB for now to improve reliability
        if bytes_written + bytes_offset >= min(MAX_FILE_SIZE, 2 ** 30):
            transaction.set_rollback(True)
            return 0


@instrumented_task(name="sentry.data_export.tasks.merge_blobs", queue="data_export", acks_late=True)
def merge_export_blobs(data_export_id, **kwargs):
    with sentry_sdk.start_transaction(
        op="task.data_export.merge", name="DataExportMerge", sampled=True,
    ):
        try:
            data_export = ExportedData.objects.get(id=data_export_id)
        except ExportedData.DoesNotExist as error:
            logger.exception(error)
            return

        with sentry_sdk.configure_scope() as scope:
            if data_export.user:
                user = {}
                if data_export.user.id:
                    user["id"] = data_export.user.id
                if data_export.user.username:
                    user["username"] = data_export.user.username
                if data_export.user.email:
                    user["email"] = data_export.user.email
                scope.user = user
            scope.user = user
            scope.set_tag("organization.slug", data_export.organization.slug)
            scope.set_tag("export.type", ExportQueryType.as_str(data_export.query_type))
            scope.set_extra("export.query", data_export.query_info)

        # adapted from `putfile` in  `src/sentry/models/file.py`
        try:
            with transaction.atomic():
                file = File.objects.create(
                    name=data_export.file_name,
                    type="export.csv",
                    headers={"Content-Type": "text/csv"},
                )
                size = 0
                file_checksum = sha1(b"")

                for export_blob in ExportedDataBlob.objects.filter(
                    data_export=data_export
                ).order_by("offset"):
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
                file.save()
                data_export.finalize_upload(file=file)

                time_elapsed = (timezone.now() - data_export.date_added).total_seconds()
                metrics.timing("dataexport.duration", time_elapsed, sample_rate=1.0)
                logger.info("dataexport.end", extra={"data_export_id": data_export_id})
                metrics.incr("dataexport.end", tags={"success": True}, sample_rate=1.0)
        except Exception as error:
            metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
            metrics.incr(
                "dataexport.end",
                tags={"success": False, "error": six.text_type(error)},
                sample_rate=1.0,
            )
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
