from __future__ import absolute_import
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.data_export.create_record", queue="data_export")
def create_record():
    return


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data():
    return
