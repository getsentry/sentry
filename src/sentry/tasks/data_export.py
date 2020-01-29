from __future__ import absolute_import

import csv
from datetime import datetime

from sentry.api import client
from sentry.constants import ExportQueryType
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data(data_export):
    if data_export.query_type == ExportQueryType.DISCOVER_V1:
        process_discover_v1(data_export)

    elif data_export.query_type == ExportQueryType.BILLING_REPORT:
        # TODO(Leander): Implement logic for billing report CSVs
        return
    elif data_export.query_type == ExportQueryType.ISSUE_BY_TAG:
        # TODO(Leander): Implement logic for issue tag CSVs
        return


def process_discover_v1(data_export):
    response = client.post(
        path="/organizations/{}/discover/query/".format(data_export.organization.slug),
        user=data_export.user,
        data=data_export.query_info,
    )
    response.render()
    data = response.data["data"]
    keys = data[0].keys()
    return convert_to_csv(type=ExportQueryType.DISCOVER_V1_STR, keys=keys, data=data)


def convert_to_csv(type, keys, data):
    # TODO(Leander): Consider sorting the keys in a consistent order(?)
    time_string = datetime.now().strftime("%m:%d:%Y__%H:%M")
    file_path = "/Users/leanderrodrigues/Downloads/{}-{}.csv".format(type, time_string)

    with open(file_path, "w") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)
        csvfile.close()
    # TODO(Leander): Upload the file to GCS and record the storage_url in ExportedData
    return


def alert_error():
    # TODO(Leander): Handle errors in these tasks.
    return
