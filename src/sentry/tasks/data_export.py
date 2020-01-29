from __future__ import absolute_import

import six
from datetime import datetime

from sentry.api import client
from sentry.constants import ExportQueryType
from sentry.models import User
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data(data_export):
    if data_export.query_type == ExportQueryType.DISCOVER_V1:
        process_discover_v1(data_export)
        # The plan, hijack the discover query pipeline to send a request to that endpoint.
        # Using the returned data, form a CSV and save it locally

    elif data_export.query_type == ExportQueryType.BILLING_REPORT:
        # TODO(Leander): Implement logic for billing report CSVs
        return
    elif data_export.query_type == ExportQueryType.ISSUE_BY_TAG:
        # TODO(Leander): Implement logic for issue tag CSVs
        return


def process_discover_v1(data_export):
    # Get the user who made the data export request
    user = User.objects.get(id=data_export.user_id)
    # Use their credentials to create an export job
    response = client.post(
        path="/organizations/sentry/discover/query/", user=user, data=data_export.query_info
    )
    response.render()
    # Extract the keys and data
    data = response.data["data"]
    keys = data[0].keys()
    return convert_to_csv(type=ExportQueryType.DISCOVER_V1_STR, keys=keys, data=data)


# /Users/leanderrodrigues/Downloads/CdI6NhU5.csv


def convert_to_csv(type, keys, data):
    # TODO(Leander): Consider sorting the keys in a consistent order(?)
    time_string = datetime.now().strftime("%m:%d:%Y")
    file_path = "/Users/leanderrodrigues/Downloads/{}-{}.csv".format(type, time_string)
    with open(file_path, "w") as f:
        key_string = ""
        for key in keys:
            if key is not keys[-1]:
                key_string = key_string + key + ","
            else:
                key_string = key_string + key + "\n"
                f.writelines([key_string])
        for item in data:
            item_string = ""
            for key in keys:
                if key is not keys[-1]:
                    item_string = item_string + six.binary_type(item[key]) + ","
                else:
                    item_string = item_string + six.binary_type(item[key]) + "\n"
            f.writelines([item_string])
        f.close()
    return


def alert_error():
    # TODO(Leander): Handle errors in these tasks.
    return
