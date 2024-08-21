import click

from sentry.runner.decorators import configuration


@click.command()
@click.option(
    "--generate-tasks",
    default=False,
    is_flag=True,
    help="If true, will generate a mini task to spawn with logs",
)
@configuration
def task_worker(generate_tasks) -> None:
    from sentry.taskdemo import broken, demotasks, say_hello

    if generate_tasks:
        say_hello.delay("it works!")
        broken.delay("safeboom")
    from sentry.taskworker.worker import Worker

    Worker(namespace=demotasks.name).start()
