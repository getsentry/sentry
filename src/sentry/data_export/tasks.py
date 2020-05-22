from __future__ import absolute_import

import csv
import logging
import six
import tempfile
from django.db import transaction, IntegrityError

from sentry.models import File
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import capture_exception

from .base import ExportError, ExportQueryType, SNUBA_MAX_RESULTS
from .models import ExportedData
from .utils import convert_to_utf8, snuba_error_handler
from .processors.discover import DiscoverProcessor
from .processors.issues_by_tag import IssuesByTagProcessor


logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.data_export.tasks.assemble_download", queue="data_export")
def assemble_download(
    data_export_id, limit=1000000, batch_size=SNUBA_MAX_RESULTS, environment_id=None
):
    # Get the ExportedData object
    try:
        logger.info("dataexport.start", extra={"data_export_id": data_export_id})
        metrics.incr("dataexport.start", tags={"success": True}, sample_rate=1.0)
        data_export = ExportedData.objects.get(id=data_export_id)
    except ExportedData.DoesNotExist as error:
        metrics.incr("dataexport.start", tags={"success": False}, sample_rate=1.0)
        capture_exception(error)
        return

    # Create a temporary file
    try:
        with tempfile.TemporaryFile() as tf:
            # Process the query based on its type
            if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
                process_issues_by_tag(
                    data_export=data_export,
                    file=tf,
                    limit=limit,
                    batch_size=batch_size,
                    environment_id=environment_id,
                )
            elif data_export.query_type == ExportQueryType.DISCOVER:
                process_discover(
                    data_export=data_export, file=tf, limit=limit, environment_id=environment_id
                )
            # Create a new File object and attach it to the ExportedData
            tf.seek(0)
            try:
                with transaction.atomic():
                    file = File.objects.create(
                        name=data_export.file_name,
                        type="export.csv",
                        headers={"Content-Type": "text/csv"},
                    )
                    file.putfile(tf, logger=logger)
                    data_export.finalize_upload(file=file)
                    logger.info("dataexport.end", extra={"data_export_id": data_export_id})
                    metrics.incr("dataexport.end", sample_rate=1.0)
            except IntegrityError as error:
                metrics.incr(
                    "dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0
                )
                logger.info(
                    "dataexport.error: {}".format(six.text_type(error)),
                    extra={"query": data_export.payload, "org": data_export.organization_id},
                )
                capture_exception(error)
                raise ExportError("Failed to save the assembled file")
    except ExportError as error:
        return data_export.email_failure(message=six.text_type(error))
    except BaseException as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info(
            "dataexport.error: {}".format(six.text_type(error)),
            extra={"query": data_export.payload, "org": data_export.organization_id},
        )
        capture_exception(error)
        return data_export.email_failure(message="Internal processing failure")


def process_issues_by_tag(data_export, file, limit, batch_size, environment_id):
    """
    Convert the tag query to a CSV, writing it to the provided file.
    """
    payload = data_export.query_info
    try:
        processor = IssuesByTagProcessor(
            project_id=payload["project"][0],
            group_id=payload["group"],
            key=payload["key"],
            environment_id=environment_id,
        )
    except ExportError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise error

    writer = create_writer(file, processor.header_fields)
    iteration = 0
    with snuba_error_handler(logger=logger):
        is_completed = False
        while not is_completed:
            offset = batch_size * iteration
            next_offset = batch_size * (iteration + 1)
            is_exceeding_limit = limit and limit < next_offset
            gtv_list_unicode = processor.get_serialized_data(limit=batch_size, offset=offset)
            # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
            # See associated comment in './utils.py'
            gtv_list = convert_to_utf8(gtv_list_unicode)
            if is_exceeding_limit:
                # Since the next offset will pass the limit, just write the remainder
                writer.writerows(gtv_list[: limit % batch_size])
            else:
                writer.writerows(gtv_list)
                iteration += 1
            # If there are no returned results, or we've passed the limit, stop iterating
            is_completed = len(gtv_list) == 0 or is_exceeding_limit


def process_discover(data_export, file, limit, batch_size, environment_id):
    """
    Convert the discovery query to a CSV, writing it to the provided file.
    """
    try:
        processor = DiscoverProcessor(
            discover_query=data_export.query_info, organization_id=data_export.organization_id
        )
    except ExportError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise error

    writer = create_writer(file, processor.header_fields)
    iteration = 0
    with snuba_error_handler(logger=logger):
        is_completed = False
        while not is_completed:
            offset = batch_size * iteration
            next_offset = batch_size * (iteration + 1)
            is_exceeding_limit = limit and limit < next_offset
            raw_data_unicode = processor.data_fn(offset=offset, limit=batch_size)["data"]
            # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
            # See associated comment in './utils.py'
            raw_data = convert_to_utf8(raw_data_unicode)
            raw_data = processor.handle_fields(raw_data)
            if is_exceeding_limit:
                # Since the next offset will pass the limit, just write the remainder
                writer.writerows(raw_data[: limit % batch_size])
            else:
                writer.writerows(raw_data)
                iteration += 1
            # If there are no returned results, or we've passed the limit, stop iterating
            is_completed = len(raw_data) == 0 or is_exceeding_limit


def create_writer(file, fields):
    writer = csv.DictWriter(file, fields, extrasaction="ignore")
    writer.writeheader()
    return writer
