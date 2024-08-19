from datetime import datetime

import click

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
    from sentry.taskworker.models import PendingTasks
    from sentry.taskworker.service.service import task_service

    if generate_empty_task:
        PendingTasks(
            topic="foobar",
            task_name="foo_the_bars",
            parameters=None,
            task_namespace="baz",
            partition=1,
            offset=1,
            received_at=datetime.now(),
            state=PendingTasks.States.PENDING,
            deadletter_at=datetime.now(),
            processing_deadline=datetime.now(),
        ).save()

    while True:
        task = task_service.get_task()
        if task is None:
            click.echo("Queue is empty, goodbye")
            return

        task_service.complete_task(task_id=task.id)
        click.echo(f"processed task with ID {task.id}")
