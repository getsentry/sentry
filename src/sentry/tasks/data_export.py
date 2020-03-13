from __future__ import absolute_import

import csv
import logging
import six
import tempfile
from contextlib import contextmanager
from django.db import transaction, IntegrityError

from sentry.constants import ExportQueryType
from sentry.models import ExportedData, File
from sentry.processing.base import ProcessingError
from sentry.processing.issues_by_tag import (
    get_project_and_group,
    get_lookup_key,
    get_eventuser_callback,
    get_fields,
    get_issues_list,
    serialize_issue,
)
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception

SNUBA_MAX_RESULTS = 1000

logger = logging.getLogger(__name__)


class DataExportError(Exception):
    pass


@instrumented_task(name="sentry.tasks.data_export.assemble_download", queue="data_export")
def assemble_download(data_export_id, limit=None, environment_id=None):
    # Extract the ExportedData object
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
                file_name = process_issues_by_tag(
                    data_export=data_export, file=tf, limit=limit, environment_id=environment_id
                )
            elif data_export.query_type == ExportQueryType.DISCOVER:
                file_name = process_discover(
                    data_export=data_export, file=tf, limit=limit, environment_id=environment_id
                )
            # Create a new File object and attach it to the ExportedData
            tf.seek(0)
            try:
                with transaction.atomic():
                    file = File.objects.create(
                        name=file_name, type="export.csv", headers={"Content-Type": "text/csv"}
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
                raise DataExportError("Failed to save the assembled file")
    except DataExportError as error:
        return data_export.email_failure(message=error)
    except NotImplementedError as error:
        return data_export.email_failure(message=error)
    except BaseException as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error(
            "dataexport.error: {}".format(six.text_type(error)),
            extra={"query": data_export.payload, "org": data_export.organization_id},
        )
        return data_export.email_failure(message="Internal processing failure")


def process_billing_report(data_export, file):
    # TODO(Leander): Implement processing for Billing Reports
    raise NotImplementedError("Billing report processing has not been implemented yet")


def process_issues_by_tag(data_export, file, limit, environment_id):
    """
    Convert the tag query to a CSV, writing it to the provided file.
    Returns the suggested file name.
    (Adapted from 'src/sentry/web/frontend/group_tag_export.py')
    """
    payload = data_export.query_info
    key = payload["key"]

    try:
        project, group = get_project_and_group(payload["project_id"], payload["group_id"])
    except ProcessingError as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise DataExportError(error)

    # Create the callback list and lookup key
    callbacks = [get_eventuser_callback(group.project_id)] if key == "user" else []
    lookup_key = get_lookup_key(key)

    # Example file name: Issues-by-Tag_project10-user_721.csv
    file_name = get_file_name(
        export_type=ExportQueryType.ISSUES_BY_TAG_STR,
        info_string=six.text_type("{}-{}".format(project.slug, key)),
        data_export_id=data_export.id,
    )

    # Iterate through all the GroupTagValues
    writer = create_writer(file, get_fields(key))
    iteration = 0
    with snuba_error_handler():
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            gtv_list = get_issues_list(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=environment_id,
                key=lookup_key,
                callbacks=callbacks,
                offset=offset,
            )
            if len(gtv_list) == 0:
                break
            gtv_list_raw = [serialize_issue(item, key) for item in gtv_list]
            if limit and limit < next_offset:
                # Since the next offset will pass the limit, write the remainder and quit
                writer.writerows(gtv_list_raw[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(gtv_list_raw)
                iteration += 1
    return file_name


def process_discover(data_export, file):
    # TODO(Leander): Implement processing for Discover
    raise NotImplementedError("Discover processing has not been implemented yet")


def create_writer(file, fields):
    writer = csv.DictWriter(file, fields)
    writer.writeheader()
    return writer


def get_file_name(export_type, info_string, data_export_id, extension="csv"):
    file_name = six.text_type(
        "{}_{}_{}.{}".format(export_type, info_string, data_export_id, extension)
    )
    return file_name


# Adapted into contextmanager from 'src/sentry/api/endpoints/organization_events.py'
@contextmanager
def snuba_error_handler():
    try:
        yield
    except snuba.QueryOutsideRetentionError as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise DataExportError("Invalid date range. Please try a more recent date range.")
    except snuba.QueryIllegalTypeOfArgument as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise DataExportError("Invalid query. Argument to function is wrong type.")
    except snuba.SnubaError as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        message = "Internal error. Please try again."
        if isinstance(
            error,
            (
                snuba.RateLimitExceeded,
                snuba.QueryMemoryLimitExceeded,
                snuba.QueryTooManySimultaneous,
            ),
        ):
            message = "Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
        elif isinstance(
            error,
            (snuba.UnqualifiedQueryError, snuba.QueryExecutionError, snuba.SchemaValidationError),
        ):
            message = "Internal error. Your query failed to run."
        raise DataExportError(message)
