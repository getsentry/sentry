from __future__ import absolute_import, print_function

import signal
import sys
from multiprocessing import cpu_count

import click

from sentry.runner.decorators import configuration, log_options
from sentry.bgtasks.api import managed_bgtasks
from sentry.ingest.types import ConsumerType


class AddressParamType(click.ParamType):
    name = "address"

    def __call__(self, value, param=None, ctx=None):
        if value is None:
            return (None, None)
        return self.convert(value, param, ctx)

    def convert(self, value, param, ctx):
        if ":" in value:
            host, port = value.split(":", 1)
            port = int(port)
        else:
            host = value
            port = None
        return host, port


Address = AddressParamType()


class QueueSetType(click.ParamType):
    name = "text"

    def convert(self, value, param, ctx):
        if value is None:
            return None
        # Providing a compatibility with splitting
        # the `events` queue until multiple queues
        # without the need to explicitly add them.
        queues = set()
        for queue in value.split(","):
            if queue == "events":
                queues.add("events.preprocess_event")
                queues.add("events.process_event")
                queues.add("events.save_event")

                from sentry.runner.initializer import show_big_error

                show_big_error(
                    [
                        "DEPRECATED",
                        "`events` queue no longer exists.",
                        "Switch to using:",
                        "- events.preprocess_event",
                        "- events.process_event",
                        "- events.save_event",
                    ]
                )
            else:
                queues.add(queue)
        return frozenset(queues)


QueueSet = QueueSetType()


@click.group()
def run():
    "Run a service."


@run.command()
@click.option("--bind", "-b", default=None, help="Bind address.", type=Address)
@click.option(
    "--workers", "-w", default=0, help="The number of worker processes for handling requests."
)
@click.option("--upgrade", default=False, is_flag=True, help="Upgrade before starting.")
@click.option(
    "--with-lock", default=False, is_flag=True, help="Use a lock if performing an upgrade."
)
@click.option(
    "--noinput", default=False, is_flag=True, help="Do not prompt the user for input of any kind."
)
@log_options()
@configuration
def web(bind, workers, upgrade, with_lock, noinput):
    "Run web service."
    if upgrade:
        click.echo("Performing upgrade before service startup...")
        from sentry.runner import call_command

        try:
            call_command(
                "sentry.runner.commands.upgrade.upgrade",
                verbosity=0,
                noinput=noinput,
                lock=with_lock,
            )
        except click.ClickException:
            if with_lock:
                click.echo("!! Upgrade currently running from another process, skipping.", err=True)
            else:
                raise

    with managed_bgtasks(role="web"):
        from sentry.services.http import SentryHTTPServer

        SentryHTTPServer(host=bind[0], port=bind[1], workers=workers).run()


@run.command()
@click.option("--bind", "-b", default=None, help="Bind address.", type=Address)
@click.option("--upgrade", default=False, is_flag=True, help="Upgrade before starting.")
@click.option(
    "--noinput", default=False, is_flag=True, help="Do not prompt the user for input of any kind."
)
@configuration
def smtp(bind, upgrade, noinput):
    "Run inbound email service."
    if upgrade:
        click.echo("Performing upgrade before service startup...")
        from sentry.runner import call_command

        call_command("sentry.runner.commands.upgrade.upgrade", verbosity=0, noinput=noinput)

    from sentry.services.smtp import SentrySMTPServer

    with managed_bgtasks(role="smtp"):
        SentrySMTPServer(host=bind[0], port=bind[1]).run()


def run_worker(**options):
    """
    This is the inner function to actually start worker.
    """
    from django.conf import settings

    if settings.CELERY_ALWAYS_EAGER:
        raise click.ClickException(
            "Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers."
        )

    # These options are no longer used, but keeping around
    # for backwards compatibility
    for o in "without_gossip", "without_mingle", "without_heartbeat":
        options.pop(o, None)

    from sentry.celery import app

    with managed_bgtasks(role="worker"):
        worker = app.Worker(
            # NOTE: without_mingle breaks everything,
            # we can't get rid of this. Intentionally kept
            # here as a warning. Jobs will not process.
            # without_mingle=True,
            without_gossip=True,
            without_heartbeat=True,
            pool_cls="processes",
            **options
        )
        worker.start()
        try:
            sys.exit(worker.exitcode)
        except AttributeError:
            # `worker.exitcode` was added in a newer version of Celery:
            # https://github.com/celery/celery/commit/dc28e8a5
            # so this is an attempt to be forward compatible
            pass


@run.command()
@click.option(
    "--hostname",
    "-n",
    help=(
        "Set custom hostname, e.g. 'w1.%h'. Expands: %h" "(hostname), %n (name) and %d, (domain)."
    ),
)
@click.option(
    "--queues",
    "-Q",
    type=QueueSet,
    help=(
        "List of queues to enable for this worker, separated by "
        "comma. By default all configured queues are enabled. "
        "Example: -Q video,image"
    ),
)
@click.option("--exclude-queues", "-X", type=QueueSet)
@click.option(
    "--concurrency",
    "-c",
    default=cpu_count(),
    help=(
        "Number of child processes processing the queue. The "
        "default is the number of CPUs available on your "
        "system."
    ),
)
@click.option(
    "--logfile", "-f", help=("Path to log file. If no logfile is specified, stderr is used.")
)
@click.option("--quiet", "-q", is_flag=True, default=False)
@click.option("--no-color", is_flag=True, default=False)
@click.option("--autoreload", is_flag=True, default=False, help="Enable autoreloading.")
@click.option("--without-gossip", is_flag=True, default=False)
@click.option("--without-mingle", is_flag=True, default=False)
@click.option("--without-heartbeat", is_flag=True, default=False)
@click.option("--max-tasks-per-child", default=10000)
@click.option("--ignore-unknown-queues", is_flag=True, default=False)
@log_options()
@configuration
def worker(ignore_unknown_queues, **options):
    """Run background worker instance and autoreload if necessary."""

    from sentry.celery import app

    known_queues = frozenset(c_queue.name for c_queue in app.conf.CELERY_QUEUES)

    if options["queues"] is not None:
        if not options["queues"].issubset(known_queues):
            unknown_queues = options["queues"] - known_queues
            message = "Following queues are not found: %s".format(unkown_queues)
            if ignore_unknown_queues:
                    options["queues"] -= unknown_queues
                    click.echo(message)
                else:
                    raise click.ClickException(message)

    if options["exclude_queues"] is not None:
        if not options["exclude_queues"].issubset(known_queues):
            unknown_queues = options["exclude_queues"] - known_queues
            message = "Following queues cannot be excluded as they don't exist: %s".format(unkown_queues)
            if ignore_unknown_queues:
                    options["exclude_queues"] -= unknown_queues
                    click.echo(message)
                else:
                    raise click.ClickException(message)

    if options["autoreload"]:
        from django.utils import autoreload

        # Note this becomes autoreload.run_with_reloader in django 2.2
        autoreload.main(run_worker, kwargs=options)
    else:
        run_worker(**options)


@run.command()
@click.option(
    "--pidfile",
    help=(
        "Optional file used to store the process pid. The "
        "program will not start if this file already exists and "
        "the pid is still alive."
    ),
)
@click.option(
    "--logfile", "-f", help=("Path to log file. If no logfile is specified, stderr is used.")
)
@click.option("--quiet", "-q", is_flag=True, default=False)
@click.option("--no-color", is_flag=True, default=False)
@click.option("--autoreload", is_flag=True, default=False, help="Enable autoreloading.")
@click.option("--without-gossip", is_flag=True, default=False)
@click.option("--without-mingle", is_flag=True, default=False)
@click.option("--without-heartbeat", is_flag=True, default=False)
@log_options()
@configuration
def cron(**options):
    "Run periodic task dispatcher."
    from django.conf import settings

    if settings.CELERY_ALWAYS_EAGER:
        raise click.ClickException(
            "Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers."
        )

    from sentry.celery import app

    with managed_bgtasks(role="cron"):
        app.Beat(
            # without_gossip=True,
            # without_mingle=True,
            # without_heartbeat=True,
            **options
        ).run()


@run.command("post-process-forwarder")
@click.option(
    "--consumer-group",
    default="snuba-post-processor",
    help="Consumer group used to track event offsets that have been enqueued for post-processing.",
)
@click.option(
    "--commit-log-topic",
    default="snuba-commit-log",
    help="Topic that the Snuba writer is publishing its committed offsets to.",
)
@click.option(
    "--synchronize-commit-group",
    default="snuba-consumers",
    help="Consumer group that the Snuba writer is committing its offset as.",
)
@click.option(
    "--commit-batch-size",
    default=1000,
    type=int,
    help="How many messages to process (may or may not result in an enqueued task) before committing offsets.",
)
@click.option(
    "--initial-offset-reset",
    default="latest",
    type=click.Choice(["earliest", "latest"]),
    help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
)
@log_options()
@configuration
def post_process_forwarder(**options):
    from sentry import eventstream
    from sentry.eventstream.base import ForwarderNotRequired

    try:
        eventstream.run_post_process_forwarder(
            consumer_group=options["consumer_group"],
            commit_log_topic=options["commit_log_topic"],
            synchronize_commit_group=options["synchronize_commit_group"],
            commit_batch_size=options["commit_batch_size"],
            initial_offset_reset=options["initial_offset_reset"],
        )
    except ForwarderNotRequired:
        sys.stdout.write(
            "The configured event stream backend does not need a forwarder "
            "process to enqueue post-process tasks. Exiting...\n"
        )
        return


@run.command("query-subscription-consumer")
@click.option(
    "--group",
    default="query-subscription-consumer",
    help="Consumer group to track query subscription offsets. ",
)
@click.option("--topic", default=None, help="Topic to get subscription updates from.")
@click.option(
    "--commit-batch-size",
    default=100,
    type=int,
    help="How many messages to process before committing offsets.",
)
@click.option(
    "--initial-offset-reset",
    default="latest",
    type=click.Choice(["earliest", "latest"]),
    help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
)
@log_options()
@configuration
def query_subscription_consumer(**options):
    from sentry.snuba.query_subscription_consumer import QuerySubscriptionConsumer

    subscriber = QuerySubscriptionConsumer(
        group_id=options["group"],
        topic=options["topic"],
        commit_batch_size=options["commit_batch_size"],
        initial_offset_reset=options["initial_offset_reset"],
    )

    def handler(signum, frame):
        subscriber.shutdown()

    signal.signal(signal.SIGINT, handler)

    subscriber.run()


def batching_kafka_options(group):
    """
    Expose batching_kafka_consumer options as CLI args.

    TODO(markus): Probably want to have this as part of batching_kafka_consumer
    as this is duplicated effort between Snuba and Sentry.
    """

    def inner(f):
        f = click.option(
            "--consumer-group",
            "group_id",
            default=group,
            help="Kafka consumer group for the outcomes consumer. ",
        )(f)

        f = click.option(
            "--max-batch-size",
            "max_batch_size",
            default=100,
            type=int,
            help="How many messages to process before committing offsets.",
        )(f)

        f = click.option(
            "--max-batch-time-ms",
            "max_batch_time",
            default=1000,
            type=int,
            help="How long to batch for before committing offsets.",
        )(f)

        f = click.option(
            "--auto-offset-reset",
            "auto_offset_reset",
            default="latest",
            type=click.Choice(["earliest", "latest", "error"]),
            help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
        )(f)

        return f

    return inner


@run.command("ingest-consumer")
@log_options()
@click.option(
    "consumer_types",
    "--consumer-type",
    default=[],
    multiple=True,
    help="Specify which type of consumer to create, i.e. from which topic to consume messages. By default all ingest-related topics are consumed ",
    type=click.Choice(ConsumerType.all()),
)
@click.option(
    "--all-consumer-types",
    default=False,
    is_flag=True,
    help="Listen to all consumer types at once.",
)
@batching_kafka_options("ingest-consumer")
@click.option(
    "--concurrency",
    type=int,
    default=None,
    help="(Deprecated) Ingest consumers no longer use multiple processing threads.",
)
@configuration
def ingest_consumer(consumer_types, all_consumer_types, **options):
    """
    Runs an "ingest consumer" task.

    The "ingest consumer" tasks read events from a kafka topic (coming from Relay) and schedules
    process event celery tasks for them
    """
    from sentry.ingest.ingest_consumer import get_ingest_consumer
    from sentry.utils import metrics

    if all_consumer_types:
        if consumer_types:
            raise click.ClickException(
                "Cannot specify --all-consumer types and --consumer-type at the same time"
            )
        else:
            consumer_types = set(ConsumerType.all())

    if not all_consumer_types and not consumer_types:
        raise click.ClickException("Need to specify --all-consumer-types or --consumer-type")

    concurrency = options.pop("concurrency", None)
    if concurrency is not None:
        click.echo("Warning: `concurrency` argument is deprecated and will be removed.", err=True)

    with metrics.global_tags(
        ingest_consumer_types=",".join(sorted(consumer_types)), _all_threads=True
    ):
        get_ingest_consumer(consumer_types=consumer_types, **options).run()
