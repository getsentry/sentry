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
from .utils import convert_to_ascii, snuba_error_handler
from .processors.discover import DiscoverProcessor
from .processors.issues_by_tag import IssuesByTagProcessor


logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.data_export.tasks.assemble_download", queue="data_export")
def assemble_download(data_export_id, limit=None, environment_id=None):
    # Get the ExportedData object
    try:
        logger.info("dataexport.start", extra={"data_export_id": data_export_id})
        data_export = ExportedData.objects.get(id=data_export_id)
    except ExportedData.DoesNotExist as error:
        capture_exception(error)
        return

    # Create a temporary file
    try:
        with tempfile.TemporaryFile() as tf:
            # Process the query based on its type
            if data_export.query_type == ExportQueryType.ISSUES_BY_TAG:
                process_issues_by_tag(
                    data_export=data_export, file=tf, limit=limit, environment_id=environment_id
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
            except IntegrityError as error:
                metrics.incr("dataexport.error", instance=six.text_type(error))
                logger.error(
                    "dataexport.error: {}".format(six.text_type(error)),
                    extra={"query": data_export.payload, "org": data_export.organization_id},
                )
                raise ExportError("Failed to save the assembled file")
    except ExportError as error:
        return data_export.email_failure(message=six.text_type(error))
    except BaseException as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error(
            "dataexport.error: {}".format(six.text_type(error)),
            extra={"query": data_export.payload, "org": data_export.organization_id},
        )
        return data_export.email_failure(message="Internal processing failure")


def process_issues_by_tag(data_export, file, limit, environment_id):
    """
    Convert the tag query to a CSV, writing it to the provided file.
    """
    payload = data_export.query_info
    try:
        processor = IssuesByTagProcessor(
            project_id=payload["project_id"],
            group_id=payload["group_id"],
            key=payload["key"],
            environment_id=environment_id,
        )
    except ExportError as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise error

    writer = create_writer(file, processor.header_fields)
    iteration = 0
    with snuba_error_handler(logger=logger):
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            gtv_list_unicode = processor.get_serialized_data(offset=offset)
            if len(gtv_list_unicode) == 0:
                break
            # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
            # See associated comment in './utils.py'
            gtv_list = convert_to_ascii(gtv_list_unicode)
            if limit and limit < next_offset:
                writer.writerows(gtv_list[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(gtv_list)
                iteration += 1


def process_discover(data_export, file, limit, environment_id):
    """
    Convert the discovery query to a CSV, writing it to the provided file.
    """
    try:
        processor = DiscoverProcessor(
            discover_query=data_export.query_info, organization_id=data_export.organization_id
        )
    except ExportError as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise error

    writer = create_writer(file, processor.header_fields)
    iteration = 0
    with snuba_error_handler(logger=logger):
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            raw_data_unicode = processor.data_fn(offset=offset, limit=SNUBA_MAX_RESULTS)["data"]
            if len(raw_data_unicode) == 0:
                break
            # TODO(python3): Remove next line once the 'csv' module has been updated to Python 3
            # See associated comment in './utils.py'
            raw_data = convert_to_ascii(raw_data_unicode)
            raw_data = [processor.alias_fields(raw_dict) for raw_dict in raw_data]
            if limit and limit < next_offset:
                writer.writerows(raw_data[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(raw_data)
                iteration += 1


def create_writer(file, fields):
    writer = csv.DictWriter(file, fields, extrasaction="ignore")
    writer.writeheader()
    return writer
