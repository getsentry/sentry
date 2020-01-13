from __future__ import absolute_import
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.data_export.compile_data", queue="data_export")
def compile_data():
    # print ("I AM A ROBOT COMPILING DATA 🔥🔥🔥")
    return
