from __future__ import annotations

import logging
import os
import random
import signal
import time
from typing import Any

import click

import sentry.taskworker.constants as taskworker_constants
from sentry.bgtasks.api import managed_bgtasks
from sentry.runner.decorators import configuration, log_options
from sentry.utils.kafka import run_processor_with_signals

DEFAULT_BLOCK_SIZE = int(32 * 1e6)
logger = logging.getLogger("sentry.runner.commands.run")


def _address_validate(
    ctx: object, param: object, value: str | None
) -> tuple[None, None] | tuple[str, int | None]:
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

    def convert(self, value: str | None, param: object, ctx: object) -> frozenset[str] | None:
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
def run() -> None:
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
def web(
    bind: tuple[None, None] | tuple[str, int | None],
    workers: int,
    upgrade: bool,
    with_lock: bool,
    noinput: bool,
) -> None:
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
    "--redis-cluster",
    help="The rediscluster name to store run state in.",
    default="default",
)
@log_options()
@configuration
def taskworker_scheduler(redis_cluster: str, **options: Any) -> None:
    """
    Run a scheduler for taskworkers

    All tasks defined in settings.TASKWORKER_SCHEDULES will be scheduled as required.
    """
    from django.conf import settings

    from sentry.taskworker.runtime import app
    from sentry.taskworker.scheduler.runner import RunStorage, ScheduleRunner
    from sentry.utils.redis import redis_clusters

    app.load_modules()
    run_storage = RunStorage(redis_clusters.get(redis_cluster))

    with managed_bgtasks(role="taskworker-scheduler"):
        runner = ScheduleRunner(app, run_storage)
        for key, schedule_data in settings.TASKWORKER_SCHEDULES.items():
            runner.add(key, schedule_data)

        logger.info(
            "taskworker.scheduler.schedule_data",
            extra={
                "schedule_keys": list(settings.TASKWORKER_SCHEDULES.keys()),
            },
        )

        runner.log_startup()
        while True:
            sleep_time = runner.tick()
            time.sleep(sleep_time)


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
def cron(**options: Any) -> None:
    # TODO(taskworker) Remove this stub command
    while True:
        click.secho(
            "The cron command has been removed. Use `sentry run taskworker-scheduler` instead.",
            fg="yellow",
        )
        time.sleep(5)


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
    default=1,
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
def worker(ignore_unknown_queues: bool, **options: Any) -> None:
    # TODO(taskworker) Remove this stub command
    while True:
        click.secho(
            "The worker command has been removed. Use `sentry run taskworker` instead.", fg="yellow"
        )
        time.sleep(5)


@run.command()
@click.option(
    "--rpc-host",
    help="The hostname and port for the taskworker-rpc. When using num-brokers the hostname will be appended with `-{i}` to connect to individual brokers.",
    default="127.0.0.1:50051",
)
@click.option(
    "--num-brokers", help="Number of brokers available to connect to", default=None, type=int
)
@click.option(
    "--rpc-host-list",
    help="Provide a comma separated list of broker RPC host:ports. Use when your broker host names are not compatible with `rpc-host`",
    default=None,
)
@click.option(
    "--max-child-task-count",
    help="Number of tasks child processes execute before being restart",
    default=taskworker_constants.DEFAULT_CHILD_TASK_COUNT,
)
@click.option("--concurrency", help="Number of child processes to create.", default=1)
@click.option(
    "--namespace", help="The dedicated task namespace that this worker processes", default=None
)
@click.option(
    "--result-queue-maxsize",
    help="Size of multiprocessing queue for child process results",
    default=taskworker_constants.DEFAULT_WORKER_QUEUE_SIZE,
)
@click.option(
    "--child-tasks-queue-maxsize",
    help="Size of multiprocessing queue for pending tasks for child processes",
    default=taskworker_constants.DEFAULT_WORKER_QUEUE_SIZE,
)
@click.option(
    "--rebalance-after",
    help="The number of tasks to process before choosing a new broker instance. Requires num-brokers > 1",
    default=taskworker_constants.DEFAULT_REBALANCE_AFTER,
)
@click.option(
    "--processing-pool-name",
    help="The name of the processing pool being used",
    default="unknown",
)
@click.option(
    "--health-check-file-path",
    help="Full path of the health check file if health check is to be enabled",
)
@click.option(
    "--health-check-sec-per-touch",
    help="The number of seconds before touching the health check file",
    default=taskworker_constants.DEFAULT_WORKER_HEALTH_CHECK_SEC_PER_TOUCH,
)
@log_options()
@configuration
def taskworker(**options: Any) -> None:
    """
    Run a taskworker worker
    """
    os.environ["GRPC_ENABLE_FORK_SUPPORT"] = "0"
    # TODO(mark) restore autoreload
    run_taskworker(**options)


def run_taskworker(
    rpc_host: str,
    num_brokers: int | None,
    rpc_host_list: str | None,
    max_child_task_count: int,
    namespace: str | None,
    concurrency: int,
    child_tasks_queue_maxsize: int,
    result_queue_maxsize: int,
    rebalance_after: int,
    processing_pool_name: str,
    health_check_file_path: str | None,
    health_check_sec_per_touch: float,
    **options: Any,
) -> None:
    """
    taskworker factory that can be reloaded
    """
    from sentry.taskworker.client.client import make_broker_hosts
    from sentry.taskworker.worker import TaskWorker

    with managed_bgtasks(role="taskworker"):
        worker = TaskWorker(
            app_module="sentry.taskworker.runtime:app",
            broker_hosts=make_broker_hosts(
                host_prefix=rpc_host, num_brokers=num_brokers, host_list=rpc_host_list
            ),
            max_child_task_count=max_child_task_count,
            namespace=namespace,
            concurrency=concurrency,
            child_tasks_queue_maxsize=child_tasks_queue_maxsize,
            result_queue_maxsize=result_queue_maxsize,
            rebalance_after=rebalance_after,
            processing_pool_name=processing_pool_name,
            health_check_file_path=health_check_file_path,
            health_check_sec_per_touch=health_check_sec_per_touch,
            **options,
        )
        exitcode = worker.start()
        raise SystemExit(exitcode)


@run.command()
@log_options()
@configuration
@click.option(
    "--repeat",
    type=int,
    help="Number of messages to send to the kafka topic",
    default=1,
    show_default=True,
)
@click.option(
    "--kwargs",
    type=str,
    help="Task function keyword arguments",
)
@click.option(
    "--args",
    type=str,
    help="Task function arguments",
)
@click.option(
    "--task-function-path",
    type=str,
    help="The path to the function name of the task to execute",
    required=True,
)
@click.option(
    "--bootstrap-servers",
    type=str,
    help="The bootstrap servers to use for the kafka topic",
    default="127.0.0.1:9092",
)
@click.option(
    "--kafka-topic",
    type=str,
    help="The kafka topic to use for the task",
    default=None,
)
@click.option(
    "--namespace",
    type=str,
    help="The namespace that the task is registered in",
    default=None,
)
@click.option(
    "--extra-arg-bytes",
    type=int,
    help="Generater random args of specified size in bytes",
    default=None,
)
def taskbroker_send_tasks(
    task_function_path: str,
    args: str,
    kwargs: str,
    repeat: int,
    bootstrap_servers: str,
    kafka_topic: str,
    namespace: str,
    extra_arg_bytes: int | None,
) -> None:
    from sentry import options
    from sentry.conf.server import KAFKA_CLUSTERS
    from sentry.utils.imports import import_string

    KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"] = bootstrap_servers
    if kafka_topic and namespace:
        options.set("taskworker.route.overrides", {namespace: kafka_topic})

    try:
        func = import_string(task_function_path)
    except Exception as e:
        click.echo(f"Error: {e}")
        raise click.Abort()

    task_args = [] if not args else eval(args)
    task_kwargs = {} if not kwargs else eval(kwargs)

    if extra_arg_bytes is not None:
        extra_padding_arg = "".join(
            [chr(ord("a") + random.randint(0, ord("z") - ord("a"))) for _ in range(extra_arg_bytes)]
        )
        task_args.append(extra_padding_arg)

    checkmarks = {int(repeat * (i / 10)) for i in range(1, 10)}
    for i in range(repeat):
        func.delay(*task_args, **task_kwargs)
        if i in checkmarks:
            click.echo(message=f"{int((i / repeat) * 100)}% complete")

    click.echo(message=f"Successfully sent {repeat} messages.")


@run.command("consumer")
@log_options()
@click.argument(
    "consumer_name",
)
@click.argument("consumer_args", nargs=-1)
@click.option(
    "--topic",
    type=str,
    help="Which physical topic to use for this consumer. This can be a topic name that is not specified in settings. The logical topic is still hardcoded in sentry.consumers.",
)
@click.option(
    "--kafka-slice-id",
    type=int,
    help="Which sliced kafka topic to use. This only applies if the target topic is configured in SLICED_KAFKA_TOPICS.",
)
@click.option(
    "--cluster", type=str, help="Which cluster definition from settings to use for this consumer."
)
@click.option(
    "--consumer-group",
    "group_id",
    required=True,
    help="Kafka consumer group for the consumer.",
)
@click.option(
    "--auto-offset-reset",
    "auto_offset_reset",
    default="earliest",
    type=click.Choice(["earliest", "latest", "error"]),
    help="Position in the commit log topic to begin reading from when no prior offset has been recorded.",
)
@click.option("--join-timeout", type=float, help="Join timeout in seconds.", default=None)
@click.option(
    "--max-poll-interval-ms",
    type=int,
    default=30000,
)
@click.option(
    "--group-instance-id",
    type=str,
    default=None,
)
@click.option(
    "--synchronize-commit-log-topic",
    help="Topic that the Snuba writer is publishing its committed offsets to.",
)
@click.option(
    "--synchronize-commit-group",
    help="Consumer group that the Snuba writer is committing its offset as.",
)
@click.option(
    "--healthcheck-file-path",
    help="A file to touch roughly every second to indicate that the consumer is still alive. See https://getsentry.github.io/arroyo/strategies/healthcheck.html for more information.",
)
@click.option(
    "--enable-dlq/--disable-dlq",
    help="Enable dlq to route invalid messages to the dlq topic. See https://getsentry.github.io/arroyo/dlqs.html#arroyo.dlq.DlqPolicy for more information.",
    is_flag=True,
    default=True,
)
@click.option(
    "--stale-threshold-sec",
    type=click.IntRange(min=120),
    help="Enable backlog queue to route stale messages to the blq topic.",
)
@click.option(
    "--log-level",
    type=click.Choice(["debug", "info", "warning", "error", "critical"], case_sensitive=False),
    help="log level to pass to the arroyo consumer",
)
@click.option(
    "--strict-offset-reset/--no-strict-offset-reset",
    default=True,
    help=(
        "--strict-offset-reset, the default, means that the kafka consumer "
        "still errors in case the offset is out of range.\n\n"
        "--no-strict-offset-reset will use the auto offset reset even in that case. "
        "This is useful in development, but not desirable in production since expired "
        "offsets mean data-loss.\n\n"
    ),
)
@click.option(
    "--max-dlq-buffer-length",
    type=int,
    help="The maximum number of messages to buffer in the dlq before dropping messages. Defaults to unbounded.",
)
@click.option(
    "--quantized-rebalance-delay-secs",
    type=int,
    default=None,
    help="Quantized rebalancing means that during deploys, rebalancing is triggered across all pods within a consumer group at the same time. The value is used by the pods to align their group join/leave activity to some multiple of the delay",
)
@click.option(
    "--shutdown-strategy-before-consumer",
    is_flag=True,
    default=False,
    help="A potential workaround for Broker Handle Destroyed during shutdown (see arroyo option).",
)
@click.option(
    "--profile-consumer-join",
    is_flag=True,
    default=False,
    help="Adds a ProcessingStrategy to the start of a consumer that records a transaction of the consumer's join() method.",
)
@click.option(
    "--enable-autocommit",
    is_flag=True,
    default=False,
    help="Enable Kafka autocommit mode with 1s commit interval. Offsets are stored via store_offsets and rdkafka commits them automatically.",
)
@click.option(
    "--retry-handle-destroyed",
    is_flag=True,
    default=False,
    help="Enable retrying on `KafkaError._DESTROY` during commit.",
)
@click.option(
    "--handle-poll-while-paused",
    is_flag=True,
    default=False,
    help="Enable polling while the consumer is paused to detect rebalancing. Useful for detecting consumer state changes during backpressure.",
)
@configuration
def basic_consumer(
    consumer_name: str,
    consumer_args: tuple[str, ...],
    topic: str | None,
    kafka_slice_id: int | None,
    quantized_rebalance_delay_secs: int | None,
    enable_autocommit: bool,
    **options: Any,
) -> None:
    """
    Launch a "new-style" consumer based on its "consumer name".

    Example:

        sentry run consumer ingest-profiles --consumer-group ingest-profiles

    runs the ingest-profiles consumer with the consumer group ingest-profiles.

    Consumers are defined in 'sentry.consumers'. Each consumer can take
    additional CLI options. Those can be passed after '--':

        sentry run consumer ingest-occurrences --consumer-group occurrence-consumer -- --processes 1

    Consumer-specific arguments can be viewed with:

        sentry run consumer ingest-occurrences --consumer-group occurrence-consumer -- --help
    """
    from sentry.consumers import get_stream_processor
    from sentry.metrics.middleware import add_global_tags
    from sentry.options import get

    log_level = options.pop("log_level", None)
    if log_level is not None:
        logging.getLogger("arroyo").setLevel(log_level.upper())

    add_global_tags(
        kafka_topic=topic, consumer_group=options["group_id"], kafka_slice_id=kafka_slice_id
    )
    processor = get_stream_processor(
        consumer_name,
        consumer_args,
        topic=topic,
        kafka_slice_id=kafka_slice_id,
        add_global_tags=True,
        enable_autocommit=enable_autocommit,
        **options,
    )

    # for backwards compat: should eventually be removed
    if not quantized_rebalance_delay_secs and consumer_name == "ingest-generic-metrics":
        quantized_rebalance_delay_secs = options.get("sentry-metrics.synchronized-rebalance-delay")

    dump_stacktrace_on_shutdown = consumer_name in get("consumer.dump_stacktrace_on_shutdown", [])

    run_processor_with_signals(
        processor, quantized_rebalance_delay_secs, dump_stacktrace_on_shutdown
    )


@run.command("dev-consumer")
@click.argument("consumer_names", nargs=-1)
@log_options()
@configuration
def dev_consumer(consumer_names: tuple[str, ...]) -> None:
    """
    Launch multiple "new-style" consumers in the same thread.

    This does the same thing as 'sentry run consumer', but is not configurable,
    hardcodes consumer groups and is highly imperformant.
    """

    from sentry.consumers import get_stream_processor

    processors = [
        get_stream_processor(
            consumer_name,
            [],
            topic=None,
            cluster=None,
            group_id="sentry-consumer",
            auto_offset_reset="latest",
            strict_offset_reset=False,
            join_timeout=None,
            max_poll_interval_ms=None,
            synchronize_commit_group=None,
            synchronize_commit_log_topic=None,
            enable_dlq=False,
            stale_threshold_sec=None,
            healthcheck_file_path=None,
            enforce_schema=True,
            profile_consumer_join=False,
        )
        for consumer_name in consumer_names
    ]

    def handler(signum: object, frame: object) -> None:
        for processor in processors:
            processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    while True:
        for processor in processors:
            processor._run_once()


@run.command("backpressure-monitor")
@log_options()
@configuration
def backpressure_monitor() -> None:
    from sentry.processing.backpressure.monitor import start_service_monitoring

    start_service_monitoring()
