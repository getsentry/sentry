from datetime import datetime

import click
import orjson

from sentry.runner.decorators import configuration


@click.command()
@click.option(
    "--generate-empty-task",
    default=False,
    is_flag=True,
    help="If true, will generate a mini task to spawn with logs",
)
@configuration
def task_worker(generate_empty_task) -> None:
    from sentry.taskdemo import demotasks
    from sentry.taskworker.models import PendingTasks

    if generate_empty_task:
        PendingTasks(
            topic=demotasks.topic,
            task_name="demos.broken",
            parameters=orjson.dumps({"args": ["safeboom"], "kwargs": {}}),
            task_namespace=demotasks.name,
            headers=orjson.dumps(dict(foo="bar", baz="bufo")),
            partition=1,
            offset=1,
            received_at=datetime.now(),
            state=PendingTasks.States.PENDING,
            deadletter_at=datetime.now(),
            processing_deadline=datetime.now(),
            retry_attempts=1,
            discard_after_attempt=None,
            deadletter_after_attempt=2,
            retry_kind=None,
        ).save()

    from sentry.taskworker.worker import Worker

    Worker(namespace=demotasks.name).start()
