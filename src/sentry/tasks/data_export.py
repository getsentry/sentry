from __future__ import absolute_import

import csv
import logging
import six
import tempfile
from contextlib import contextmanager
from django.db import transaction, IntegrityError

from sentry import tagstore
from sentry.constants import ExportQueryType
from sentry.models import EventUser, ExportedData, File, Group, Project, get_group_with_redirect
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception

SNUBA_MAX_RESULTS = 1000

logger = logging.getLogger(__name__)


class DataExportError(Exception):
    pass


@instrumented_task(name="sentry.tasks.data_export.assemble_download", queue="data_export")
def assemble_download(data_export_id):
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
                file_name = process_issue_by_tag(data_export, tf)
            elif data_export.query_type == ExportQueryType.DISCOVER:
                file_name = process_discover(data_export, tf)
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


def process_issue_by_tag(data_export, file, limit=None):
    """
    Convert the tag query to a CSV, writing it to the provided file.
    Returns the suggested file name.
    (Adapted from 'src/sentry/web/frontend/group_tag_export.py')
    """
    # Get the pertaining project
    try:
        payload = data_export.query_info
        project = Project.objects.get(id=payload["project_id"])
    except Project.DoesNotExist as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise DataExportError("Requested project does not exist")

    # Get the pertaining issue
    try:
        group, _ = get_group_with_redirect(
            payload["group_id"], queryset=Group.objects.filter(project=project)
        )
    except Group.DoesNotExist as error:
        metrics.incr("dataexport.error", instance=six.text_type(error))
        logger.error("dataexport.error: {}".format(six.text_type(error)))
        raise DataExportError("Requested issue does not exist")

    # Get the pertaining key
    key = payload["key"]
    lookup_key = six.text_type("sentry:{}").format(key) if tagstore.is_reserved_key(key) else key

    # If the key is the 'user' tag, attach the event user
    def attach_eventuser(items):
        users = EventUser.for_tags(group.project_id, [i.value for i in items])
        for item in items:
            item._eventuser = users.get(item.value)

    # Create the fields/callback lists
    if key == "user":
        callbacks = [attach_eventuser]
        fields = [
            "value",
            "id",
            "email",
            "username",
            "ip_address",
            "times_seen",
            "last_seen",
            "first_seen",
        ]
    else:
        callbacks = []
        fields = ["value", "times_seen", "last_seen", "first_seen"]

    # Example file name: Issues-by-Tag-project10-user__721.csv
    file_details = six.text_type("{}-{}__{}").format(project.slug, key, data_export.id)
    file_name = get_file_name(ExportQueryType.ISSUES_BY_TAG_STR, file_details)

    # Iterate through all the GroupTagValues
    writer = create_writer(file, fields)
    iteration = 0
    with snuba_error_handler():
        while True:
            offset = SNUBA_MAX_RESULTS * iteration
            next_offset = SNUBA_MAX_RESULTS * (iteration + 1)
            gtv_list = tagstore.get_group_tag_value_iter(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=None,
                key=lookup_key,
                callbacks=callbacks,
                offset=offset,
            )
            if len(gtv_list) == 0:
                break
            gtv_list_raw = [serialize_issue_by_tag(key, item) for item in gtv_list]
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


def get_file_name(export_type, custom_string, extension="csv"):
    file_name = six.text_type("{}-{}.{}").format(export_type, custom_string, extension)
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


################################
#  Process-specific functions  #
################################


def serialize_issue_by_tag(key, item):
    result = {
        "value": item.value,
        "times_seen": item.times_seen,
        "last_seen": item.last_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "first_seen": item.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
    }
    if key == "user":
        euser = item._eventuser
        result["id"] = euser.ident if euser else ""
        result["email"] = euser.email if euser else ""
        result["username"] = euser.username if euser else ""
        result["ip_address"] = euser.ip_address if euser else ""
    return result
