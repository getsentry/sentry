from __future__ import absolute_import

import csv
import tempfile
from contextlib import contextmanager
from django.db import transaction, IntegrityError

from sentry.constants import ExportQueryType
from sentry.models import ExportedData, File
from sentry.processing.data_export import IssuesByTag, DataExportProcessingError
from sentry.tasks.base import instrumented_task
from sentry.utils import snuba
from sentry.utils.sdk import capture_exception

SNUBA_MAX_RESULTS = 1000


class DataExportError(Exception):
    pass


@instrumented_task(name="sentry.tasks.data_export.assemble_download", queue="data_export")
def assemble_download(data_export_id):
    # Extract the ExportedData object
    try:
        data_export = ExportedData.objects.get(id=data_export_id)
    except ExportedData.DoesNotExist as error:
        return capture_exception(error)

    # Create a temporary file
    try:
        with tempfile.TemporaryFile() as tf:
            # Process the query based on its type
            if data_export.query_type == ExportQueryType.DISCOVER_V2:
                file_name = process_discover_v2(data_export, tf)
            elif data_export.query_type == ExportQueryType.BILLING_REPORT:
                file_name = process_billing_report(data_export, tf)
            elif data_export.query_type == ExportQueryType.ISSUE_BY_TAG:
                file_name = process_issue_by_tag(data_export, tf)
            # Create a new File object and attach it to the ExportedData
            tf.seek(0)
            try:
                with transaction.atomic():
                    file = File.objects.create(
                        name=file_name, type="export.csv", headers={"Content-Type": "text/csv"}
                    )
                    file.putfile(tf)
                    data_export.finalize_upload(file=file)
            except IntegrityError as error:
                capture_exception(error)
                raise DataExportError("Failed to save the assembled file")
    except DataExportError as error:
        # TODO(Leander): Implement logging
        return data_export.email_failure(message=error)
    except NotImplementedError as error:
        # TODO(Leander): Implement logging
        return data_export.email_failure(message=error)
    except BaseException as error:
        # TODO(Leander): Implement logging
        capture_exception(error)
        return data_export.email_failure(message="Internal processing failure")


def process_discover_v2(data_export, file):
    # TODO(Leander): Implement processing for Discover V2
    raise NotImplementedError("Discover V2 processing has not been implemented yet")


def process_billing_report(data_export, file):
    # TODO(Leander): Implement processing for Billing Reports
    raise NotImplementedError("Billing report processing has not been implemented yet")


def process_issue_by_tag(data_export, file, limit=None):
    """
    Convert the tag query to a CSV, writing it to the provided file.
    Returns the suggested file name.
    (Adapted from 'src/sentry/web/frontend/group_tag_export.py')
    """
    payload = data_export.query_info
    key = payload["key"]
    try:
        project, group = IssuesByTag.get_project_and_group(
            payload["project_id"], payload["group_id"]
        )
    except DataExportProcessingError as error:
        raise DataExportError(error)

    # Create the fields/callback lists
    callbacks = [IssuesByTag.get_eventuser_callback(group.project_id)] if key == "user" else []

    # Example file name: ISSUE_BY_TAG-project10-user__721.csv
    file_details = "{}-{}__{}".format(project.slug, key, data_export.id)
    file_name = get_file_name(ExportQueryType.ISSUE_BY_TAG_STR, file_details)

    # Iterate through all the GroupTagValues
    writer = create_writer(file, IssuesByTag.get_fields(key))
    iteration = 0
    with snuba_error_handler():
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            gtv_list = IssuesByTag.get_issues_list(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=None,
                key=key,
                callbacks=callbacks,
                offset=offset,
            )
            if len(gtv_list) == 0:
                break
            gtv_list_raw = [IssuesByTag.serialize_issue(key, item) for item in gtv_list]
            if limit and limit < next_offset:
                # Since the next offset will pass the limit, write the remainder and quit
                writer.writerows(gtv_list_raw[: limit % SNUBA_MAX_RESULTS])
                break
            else:
                writer.writerows(gtv_list_raw)
                iteration += 1
    return file_name


def create_writer(file, fields):
    writer = csv.DictWriter(file, fields)
    writer.writeheader()
    return writer


def get_file_name(export_type, custom_string, extension="csv"):
    file_name = u"{}-{}.{}".format(export_type, custom_string, extension)
    return file_name


# Adapted into contextmanager from 'src/sentry/api/endpoints/organization_events.py'
@contextmanager
def snuba_error_handler():
    try:
        yield
    except snuba.QueryOutsideRetentionError:
        raise DataExportError("Invalid date range. Please try a more recent date range.")
    except snuba.QueryIllegalTypeOfArgument:
        raise DataExportError("Invalid query. Argument to function is wrong type.")
    except snuba.SnubaError as error:
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
            capture_exception(error)
            message = "Internal error. Your query failed to run."
        raise DataExportError(message)
