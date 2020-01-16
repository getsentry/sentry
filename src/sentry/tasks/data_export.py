from __future__ import absolute_import
from sentry.tasks.base import instrumented_task
import time


@instrumented_task(name="sentry.tasks.data_export.create_record", queue="data_export")
def create_record():
    return


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data():
    # print ("Starting data compilation...")
    time.sleep(3)
    # print ("Finished data compilation.")

    return
