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
from .utils import snuba_error_handler
from .processors.issues_by_tag import IssuesByTagProcessor


from sentry.api.utils import get_date_range_from_params
from sentry.snuba import discover
from sentry.models import Project

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
    except NotImplementedError as error:
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

    # Iterate through all the GroupTagValues
    writer = create_writer(file, processor.header_fields)
    iteration = 0
    with snuba_error_handler(logger=logger):
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            gtv_list = processor.get_serialized_data(offset=offset)
            if len(gtv_list) == 0:
                break
            if limit and limit < next_offset:
                # Since the next offset will pass the limit, write the remainder and quit
                writer.writerows(gtv_list[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(gtv_list)
                iteration += 1


def process_discover(data_export, file, limit, environment_id):
    """
    Convert the discovery query to a CSV, writing it to the provided file.
    Returns the suggested file name.
    (Adapted from 'src/sentry/api/endpoints/organization_events.py')
    """
    payload = data_export.query_info

    start, end = get_date_range_from_params(payload)
    try:
        project = Project.objects.get(id=payload["project"])
    except Project.DoesNotExist as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise ExportError("Requested project does not exist")

    params = {
        "organization_id": data_export.organization_id,
        "project_id": [project.id],
        "start": start,
        "end": end,
    }

    def data_fn(offset, limit):
        return discover.query(
            selected_columns=payload["field"],
            query=payload["query"],
            params=params,
            offset=offset,
            limit=limit,
            referrer="api.organization-events-v2",
            auto_fields=True,
            use_aggregate_conditions=True,
        )

    with snuba_error_handler(logger=logger):
        # Get a single entry to prepare the header row
        sample = data_fn(0, 1)["data"]
        if len(sample) == 0:
            message = "No available data for the provided query"
            metrics.incr("dataexport.error", instance=message)
            logger.error("dataexport.error: {}".format(message))
            raise ExportError(message)

    # Iterate through all the GroupTagValues
    writer = create_writer(file, sample[0].keys())
    iteration = 0
    with snuba_error_handler(logger=logger):
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            raw_data = data_fn(offset, SNUBA_MAX_RESULTS)["data"]
            if len(raw_data) == 0:
                break
            if limit and limit < next_offset:
                # Since the next offset will pass the limit, write the remainder and quit
                writer.writerows(raw_data[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(raw_data)
                iteration += 1


def create_writer(file, fields):
    writer = csv.DictWriter(file, fields)
    writer.writeheader()
    return writer
