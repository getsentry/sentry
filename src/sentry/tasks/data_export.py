from __future__ import absolute_import

import csv
from datetime import datetime

from sentry import tagstore
from sentry.constants import ExportQueryType
from sentry.models import EventUser, Group, Project, get_group_with_redirect
from sentry.tasks.base import instrumented_task

CURRENT_TIME = datetime.now()
SNUBA_MAX_RESUILTS = 1000


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


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data(data_export):
    if data_export.query_type == ExportQueryType.DISCOVER_V2:
        # TODO(Leander): Implement logic for discover v2 CSVs
        return
    elif data_export.query_type == ExportQueryType.BILLING_REPORT:
        # TODO(Leander): Implement logic for billing report CSVs
        return
    elif data_export.query_type == ExportQueryType.ISSUE_BY_TAG:
        process_issue_by_tag(data_export.query_info)
        return


def process_discover_v2(data_export):
    return


def process_billing_report(data_export):
    return


def process_issue_by_tag(payload):
    """
    Convert tag payload to serialized JSON
    Adapted from 'src/sentry/web/frontend/group_tag_export.py'
    """
    # Get the pertaining project
    project = Project.objects.get(slug=payload["project_slug"])

    # Get the pertaining issue
    group, _ = get_group_with_redirect(
        payload["group_id"], queryset=Group.objects.filter(project=project)
    )

    # Get the pertaining key
    key = payload["key"]
    lookup_key = u"sentry:{0}".format(key) if tagstore.is_reserved_key(key) else key

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

    # Iterate endlessly through the GroupTagValues
    iteration = 0
    while True:
        gtv_list = tagstore.get_group_tag_value_iter(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=None,
            key=lookup_key,
            callbacks=callbacks,
            offset=SNUBA_MAX_RESUILTS * iteration,
        )

        gtv_list_raw = [serialize_issue_by_tag(key, item) for item in gtv_list]
        # Break condition
        if len(gtv_list_raw) == 0:
            break
        file_name = get_file_name(ExportQueryType.ISSUE_BY_TAG_STR, iteration)
        convert_to_csv(gtv_list_raw, fields, file_name, iteration == 0)
        iteration += 1


def get_file_name(type, iteration=-1, extension="csv"):
    time_string = CURRENT_TIME.strftime("%m:%d:%Y")
    file_name = "{}-{}-{}.{}".format(type, time_string, iteration, extension)
    return file_name


def convert_to_csv(data, fields, file_name, include_header=False):
    with open("/Users/leanderrodrigues/Downloads/" + file_name, "w") as csvfile:
        writer = csv.DictWriter(csvfile, fields)
        if include_header:
            writer.writeheader()
        writer.writerows(data)
        csvfile.close()
    return


def combine_csvs(csv_list):
    return


def alert_error():
    # TODO(Leander): Handle errors in these tasks.
    return
