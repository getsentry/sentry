import click

from sentry.runner.decorators import configuration


@click.command()
@click.option("--namespace", help="Task namespace to fetch tasks from")
@configuration
def task_worker(namespace: str) -> None:
    from sentry.taskworker.worker import Worker

    Worker(namespace=namespace).start()
