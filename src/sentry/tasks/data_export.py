from __future__ import absolute_import

import csv
from datetime import datetime

from sentry.constants import ExportQueryType
from sentry.tasks.base import instrumented_task

CURRENT_TIME = datetime.now()


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data(data_export):
    if data_export.query_type == ExportQueryType.DISCOVER_V2:
        # TODO(Leander): Implement logic for discover v2 CSVs
        return
    elif data_export.query_type == ExportQueryType.BILLING_REPORT:
        # TODO(Leander): Implement logic for billing report CSVs
        return
    elif data_export.query_type == ExportQueryType.ISSUE_BY_TAG:
        process_issue_by_tag(data_export)
        return


def process_discover_v2(data_export):
    return


def process_billing_report(data_export):
    return


def process_issue_by_tag(data_export):
    return


def get_file_name(type, iteration=-1, extension="csv"):
    time_string = CURRENT_TIME.strftime("%m:%d:%Y")
    file_name = "{}-{}-{}.{}".format(type, time_string, iteration, extension)
    return file_name


def convert_to_csv(keys, data, file_name, include_header):
    with open("/Users/leanderrodrigues/Downloads/" + file_name, "w") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=keys)
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
