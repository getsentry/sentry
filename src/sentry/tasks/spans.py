from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.spans.process_segment",
    queue="spans.process_segment",
    max_retries=0,
)
def process_segment(project_id, segment_id):
    return
