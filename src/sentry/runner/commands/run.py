from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import cpu_count
from typing import Optional

import click

from sentry.bgtasks.api import managed_bgtasks
from sentry.ingest.types import ConsumerType
from sentry.issues.run import get_occurrences_ingest_consumer
from sentry.runner.decorators import configuration, log_options
from sentry.sentry_metrics.consumers.indexer.slicing_router import get_slicing_router
from sentry.utils.kafka import run_processor_with_signals

DEFAULT_BLOCK_SIZE = int(32 * 1e6)


def _address_validate(
    ctx: click.Context, param: click.Parameter, value: str | None
) -> tuple[str | None, int | None]:
    if value is None:
        return (None, None)

    if ":" in value:
        host, port_s = value.split(":", 1)
        port: int | None = int(port_s)
    else:
        host = value
        port = None
    return host, port


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


def kafka_options(
    consumer_group: str,
    allow_force_cluster: bool = True,
    include_batching_options: bool = False,
    default_max_batch_size: Optional[int] = None,
    default_max_batch_time_ms: Optional[int] = 1000,
):

    """
    Basic set of Kafka options for a consumer.
    """

    def inner(f):
        f = click.option(
            "--consumer-group",
            "group_id",
            default=consumer_group,
            help="Kafka consumer group for the consumer.",
        )(f)

        f = click.option(
            "--auto-offset-reset",
            "auto_offset_reset",
            default="latest",
            type=click.Choice(["earliest", "latest", "error"]),
            help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
        )(f)

        if include_batching_options:
            f = click.option(
                "--max-batch-size",
                "max_batch_size",
                default=default_max_batch_size,
                type=int,
                help="Maximum number of messages to batch before flushing.",
            )(f)

            f = click.option(
                "--max-batch-time-ms",
                "max_batch_time",
                default=default_max_batch_time_ms,
                type=int,
                help="Maximum time (in seconds) to wait before flushing a batch.",
            )(f)

        if allow_force_cluster:
            f = click.option(
                "--force-topic",
                "force_topic",
                default=None,
                type=str,
                help="Override the Kafka topic the consumer will read from.",
            )(f)

            f = click.option(
                "--force-cluster",
                "force_cluster",
                default=None,
                type=str,
                help="Kafka cluster ID of the overridden topic. Configure clusters via KAFKA_CLUSTERS in server settings.",
            )(f)

        return f

    return inner


def strict_offset_reset_option():
    return click.option(
        "--strict-offset-reset/--no-strict-offset-reset",
        default=True,
        help=(
            "--strict-offset-reset, the default, means that the kafka consumer "
            "still errors in case the offset is out of range.\n\n"
            "--no-strict-offset-reset will use the auto offset reset even in that case. "
            "This is useful in development, but not desirable in production since expired "
            "offsets mean data-loss.\n\n"
            "Most consumers that do not have this option at all default to 'Not Strict'."
        ),
    )


@click.group()
def run():
    "Run a service."


@run.command()
@click.option(
    "--bind",
    "-b",
    default=None,
    help="Bind address.",
    metavar="ADDRESS",
    callback=_address_validate,
)
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
@click.option(
    "--bind",
    "-b",
    default=None,
    help="Bind address.",
    metavar="ADDRESS",
    callback=_address_validate,
)
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
            **options,
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
            message = "Following queues are not found: %s" % ",".join(sorted(unknown_queues))
            if ignore_unknown_queues:
                options["queues"] -= unknown_queues
                click.echo(message)
            else:
                raise click.ClickException(message)

    if options["exclude_queues"] is not None:
        if not options["exclude_queues"].issubset(known_queues):
            unknown_queues = options["exclude_queues"] - known_queues
            message = "Following queues cannot be excluded as they don't exist: %s" % ",".join(
                sorted(unknown_queues)
            )
            if ignore_unknown_queues:
                options["exclude_queues"] -= unknown_queues
                click.echo(message)
            else:
                raise click.ClickException(message)

    if options["autoreload"]:
        from django.utils import autoreload

        autoreload.run_with_reloader(run_worker, **options)
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
@kafka_options("snuba-post-processor", allow_force_cluster=False)
@strict_offset_reset_option()
@click.option(
    "--topic",
    type=str,
    help="Main topic with messages for post processing",
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
    "--concurrency",
    default=5,
    type=int,
    help="Thread pool size for post process worker.",
)
@click.option(
    "--entity",
    type=click.Choice(["errors", "transactions", "search_issues"]),
    help="The type of entity to process (errors, transactions, search_issues).",
)
@log_options()
@configuration
def post_process_forwarder(**options):
    from sentry import eventstream
    from sentry.eventstream.base import ForwarderNotRequired

    try:
        # TODO(markus): convert to use run_processor_with_signals -- can't yet because there's a custom shutdown handler
        eventstream.run_post_process_forwarder(
            entity=options["entity"],
            consumer_group=options["group_id"],
            topic=options["topic"],
            commit_log_topic=options["commit_log_topic"],
            synchronize_commit_group=options["synchronize_commit_group"],
            concurrency=options["concurrency"],
            initial_offset_reset=options["auto_offset_reset"],
            strict_offset_reset=options["strict_offset_reset"],
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
    "--initial-offset-reset",
    default="latest",
    type=click.Choice(["earliest", "latest"]),
    help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
)
@click.option(
    "--force-offset-reset",
    default=None,
    type=click.Choice(["earliest", "latest"]),
    help="Force subscriptions to start from a particular offset",
)
@kafka_options(
    "query-subscription-consumer",
    include_batching_options=True,
    allow_force_cluster=False,
    default_max_batch_size=1000,
)
@click.option(
    "--processes",
    default=1,
    type=int,
)
@click.option("--input-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
@click.option("--output-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
@strict_offset_reset_option()
@log_options()
@configuration
def query_subscription_consumer(**options):
    from sentry.snuba.query_subscriptions.run import get_query_subscription_consumer

    subscriber = get_query_subscription_consumer(
        topic=options["topic"],
        group_id=options["group"],
        strict_offset_reset=options["strict_offset_reset"],
        initial_offset_reset=options["initial_offset_reset"],
        max_batch_size=options["max_batch_size"],
        # Our batcher expects the time in seconds
        max_batch_time=int(options["max_batch_time"] / 1000),
        processes=options["processes"],
        input_block_size=options["input_block_size"],
        output_block_size=options["output_block_size"],
    )
    run_processor_with_signals(subscriber)


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
@kafka_options("ingest-consumer", include_batching_options=True, default_max_batch_size=100)
@click.option(
    "--concurrency",
    type=int,
    default=None,
    help="Thread pool size (only utilitized for message types that support concurrent processing)",
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
        executor = ThreadPoolExecutor(concurrency)
    else:
        executor = None

    with metrics.global_tags(
        ingest_consumer_types=",".join(sorted(consumer_types)), _all_threads=True
    ):
        consumer = get_ingest_consumer(consumer_types=consumer_types, executor=executor, **options)
        run_processor_with_signals(consumer)


@run.command("occurrences-ingest-consumer")
@kafka_options(
    "occurrence-consumer",
    include_batching_options=True,
    allow_force_cluster=False,
    default_max_batch_size=20,
)
@strict_offset_reset_option()
@configuration
@click.option(
    "--processes",
    default=1,
    type=int,
)
@click.option("--input-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
@click.option("--output-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
def occurrences_ingest_consumer(**options):
    from django.conf import settings

    from sentry.utils import metrics

    consumer_type = settings.KAFKA_INGEST_OCCURRENCES

    # Our batcher expects the time in seconds
    options["max_batch_time"] = int(options["max_batch_time"] / 1000)

    with metrics.global_tags(ingest_consumer_types=consumer_type, _all_threads=True):
        consumer = get_occurrences_ingest_consumer(consumer_type, **options)
        run_processor_with_signals(consumer)


@run.command("ingest-metrics-parallel-consumer")
@log_options()
@kafka_options("ingest-metrics-consumer", allow_force_cluster=False)
@strict_offset_reset_option()
@configuration
@click.option(
    "--processes",
    default=1,
    type=int,
)
@click.option("--input-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
@click.option("--output-block-size", type=int, default=DEFAULT_BLOCK_SIZE)
@click.option("--ingest-profile", required=True)
@click.option("--indexer-db", default="postgres")
@click.option("max_msg_batch_size", "--max-msg-batch-size", type=int, default=50)
@click.option("max_msg_batch_time", "--max-msg-batch-time-ms", type=int, default=10000)
@click.option("max_parallel_batch_size", "--max-parallel-batch-size", type=int, default=50)
@click.option("max_parallel_batch_time", "--max-parallel-batch-time-ms", type=int, default=10000)
def metrics_parallel_consumer(**options):
    from sentry.sentry_metrics.configuration import (
        IndexerStorage,
        UseCaseKey,
        get_ingest_config,
        initialize_global_consumer_state,
    )
    from sentry.sentry_metrics.consumers.indexer.parallel import get_parallel_metrics_consumer

    use_case = UseCaseKey(options.pop("ingest_profile"))
    db_backend = IndexerStorage(options.pop("indexer_db"))
    ingest_config = get_ingest_config(use_case, db_backend)
    slicing_router = get_slicing_router(ingest_config)

    initialize_global_consumer_state(ingest_config)

    streamer = get_parallel_metrics_consumer(
        indexer_profile=ingest_config, slicing_router=slicing_router, **options
    )

    run_processor_with_signals(streamer)


@run.command("billing-metrics-consumer")
@log_options()
@kafka_options("billing-metrics-consumer")
@strict_offset_reset_option()
@configuration
def metrics_billing_consumer(**options):
    from sentry.ingest.billing_metrics_consumer import get_metrics_billing_consumer

    consumer = get_metrics_billing_consumer(**options)
    run_processor_with_signals(consumer)


@run.command("ingest-profiles")
@log_options()
@click.option("--topic", default="profiles", help="Topic to get profiles data from.")
@kafka_options("ingest-profiles")
@strict_offset_reset_option()
@configuration
def profiles_consumer(**options):
    from sentry.profiles.consumers import get_profiles_process_consumer

    consumer = get_profiles_process_consumer(**options)
    run_processor_with_signals(consumer)


@run.command("ingest-replay-recordings")
@log_options()
@configuration
@kafka_options("ingest-replay-recordings")
@click.option(
    "--topic", default="ingest-replay-recordings", help="Topic to get replay recording data from"
)
def replays_recordings_consumer(**options):
    from sentry.replays.consumers import get_replays_recordings_consumer

    consumer = get_replays_recordings_consumer(**options)
    run_processor_with_signals(consumer)


@run.command("ingest-monitors")
@log_options()
@click.option("--topic", default="ingest-monitors", help="Topic to get monitor check-in data from.")
@kafka_options("ingest-monitors")
@strict_offset_reset_option()
@configuration
def monitors_consumer(**options):
    from sentry.monitors.consumers import get_monitor_check_ins_consumer

    consumer = get_monitor_check_ins_consumer(**options)
    run_processor_with_signals(consumer)


@run.command("indexer-last-seen-updater")
@log_options()
@configuration
@kafka_options(
    "indexer-last-seen-updater-consumer",
    allow_force_cluster=False,
    include_batching_options=True,
    default_max_batch_size=100,
)
@strict_offset_reset_option()
@click.option("--ingest-profile", required=True)
@click.option("--indexer-db", default="postgres")
def last_seen_updater(**options):
    from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
    from sentry.sentry_metrics.consumers.last_seen_updater import get_last_seen_updater
    from sentry.utils.metrics import global_tags

    ingest_config = get_ingest_config(
        UseCaseKey(options.pop("ingest_profile")), IndexerStorage(options.pop("indexer_db"))
    )

    consumer = get_last_seen_updater(ingest_config=ingest_config, **options)

    with global_tags(_all_threads=True, pipeline=ingest_config.internal_metrics_tag):
        run_processor_with_signals(consumer)
