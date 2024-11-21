from __future__ import annotations

import logging
import os
import signal
from multiprocessing import cpu_count
from threading import Thread

import click

from sentry.bgtasks.api import managed_bgtasks
from sentry.runner.decorators import configuration, log_options
from sentry.utils.kafka import run_processor_with_signals

DEFAULT_BLOCK_SIZE = int(32 * 1e6)


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


def run_worker(**options: Any) -> None:
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

    # NOTE: without_mingle breaks everything,
    # we can't get rid of this. Intentionally kept
    # here as a warning. Jobs will not process.
    without_mingle = os.getenv("SENTRY_WORKER_FORCE_WITHOUT_MINGLE", "false").lower() == "true"

    with managed_bgtasks(role="worker"):
        worker = app.Worker(
            without_mingle=without_mingle,
            without_gossip=True,
            without_heartbeat=True,
            pool_cls="processes",
            **options,
        )
        worker.start()
        raise SystemExit(worker.exitcode)


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
def worker(ignore_unknown_queues: bool, **options: Any) -> None:
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


@click.option("--rpc-host", help="The hostname for the taskworker-rpc", default="127.0.0.1:50051")
@click.option("--autoreload", is_flag=True, default=False, help="Enable autoreloading.")
@click.option(
    "--max-task-count", help="Number of tasks this worker should run before exiting", default=10000
)
@log_options()
@configuration
def taskworker(rpc_host: str, max_task_count: int, **options: Any) -> None:
    from sentry.taskworker.worker import TaskWorker

    with managed_bgtasks(role="taskworker"):
        worker = TaskWorker(rpc_host=rpc_host, max_task_count=max_task_count, **options)
        exitcode = worker.start()
        raise SystemExit(exitcode)


@run.command()
@click.option("--consumer-path", type=str, help="Path to taskbroker brinary")
@click.option(
    "--num-consumers",
    type=int,
    help="Number of consumers to run in the consumer group",
    default=8,
    show_default=True,
)
@click.option(
    "--num-messages",
    type=int,
    help="Number of messages to send to the kafka topic",
    default=80_000,
    show_default=True,
)
@click.option(
    "--num-restarts",
    type=int,
    help="Number of restarts for each consumers",
    default=24,
    show_default=True,
)
@click.option(
    "--min-restart-duration",
    type=int,
    help="Minimum number of seconds between each restarts per consumer",
    default=1,
    show_default=True,
)
@click.option(
    "--max-restart-duration",
    type=int,
    help="Maximum number of seconds between each restarts per consumer",
    default=30,
    show_default=True,
)
@log_options()
@configuration
def taskbroker_integration_test(
    consumer_path: str,
    num_consumers: int,
    num_messages: int,
    num_restarts: int,
    min_restart_duration: int,
    max_restart_duration: int,
) -> None:
    import random
    import subprocess
    import threading
    import time
    from pathlib import Path

    import yaml

    def manage_consumer(
        consumer_index: int,
        consumer_path: str,
        config_file: str,
        iterations: int,
        min_sleep: int,
        max_sleep: int,
        log_file_path: str,
    ) -> None:
        with open(log_file_path, "a") as log_file:
            print(f"Starting consumer {consumer_index}, writing log file to {log_file_path}")
            for i in range(iterations):
                config_file_path = f"../taskbroker/tests/{config_file}"
                process = subprocess.Popen([consumer_path, "-c", config_file_path], stderr=log_file)
                time.sleep(random.randint(min_sleep, max_sleep))
                print(
                    f"Sending SIGINT to consumer {consumer_index}, {iterations - i - 1} SIGINTs remaining"
                )
                process.send_signal(signal.SIGINT)
                try:
                    return_code = process.wait(timeout=10)
                    assert return_code == 0
                except Exception:
                    process.kill()

    # First check if taskdemo topic exists
    print("Checking if taskdemo topic already exists")
    check_topic_cmd = [
        "docker",
        "exec",
        "sentry_kafka",
        "kafka-topics",
        "--bootstrap-server",
        "localhost:9092",
        "--list",
    ]
    result = subprocess.run(check_topic_cmd, check=True, capture_output=True, text=True)
    topics = result.stdout.strip().split("\n")

    # Create taskdemo Kafka topic with 32 partitions
    if "task-worker" not in topics:
        print("task-worker topic does not exist, creating it with 32 partitions")
        create_topic_cmd = [
            "docker",
            "exec",
            "sentry_kafka",
            "kafka-topics",
            "--bootstrap-server",
            "localhost:9092",
            "--create",
            "--topic",
            "task-worker",
            "--partitions",
            "32",
            "--replication-factor",
            "1",
        ]
        subprocess.run(create_topic_cmd, check=True)
    else:
        print("Taskdemo topic already exists, making sure it has 32 partitions")
        try:
            create_topic_cmd = [
                "docker",
                "exec",
                "sentry_kafka",
                "kafka-topics",
                "--bootstrap-server",
                "localhost:9092",
                "--alter",
                "--topic",
                "task-worker",
                "--partitions",
                "32",
            ]
            subprocess.run(create_topic_cmd, check=True)
        except Exception:
            pass

    # Create config files for consumers
    print("Creating config files for consumers in taskbroker/tests")
    consumer_configs = {
        f"config_{i}.yml": {
            "db_path": f"db_{i}.sqlite",
            "kafka_topic": "task-worker",
            "kafka_consumer_group": "task-worker-integration-test",
            "kafka_auto_offset_reset": "earliest",
            "grpc_port": 50051 + i,
        }
        for i in range(num_consumers)
    }

    test_dir = Path("../taskbroker/tests")
    test_dir.mkdir(parents=True, exist_ok=True)

    for filename, config in consumer_configs.items():
        with open(test_dir / filename, "w") as f:
            yaml.safe_dump(config, f)

    try:
        # Produce a test message to the taskdemo topic
        from sentry.taskdemo import say_hello

        for i in range(num_messages):
            print(f"Sending message: {i}", end="\r")
            say_hello.delay("hello world")
        print(f"\nDone: sent {num_messages} messages")

        threads: list[Thread] = []
        for i in range(num_consumers):
            thread = threading.Thread(
                target=manage_consumer,
                args=(
                    i,
                    consumer_path,
                    f"config_{i}.yml",
                    num_restarts,
                    min_restart_duration,
                    max_restart_duration,
                    f"consumer_{i}.log",
                ),
            )
            thread.start()
            threads.append(thread)

        for t in threads:
            t.join()

    except Exception:
        raise

    query_prelude = "".join([f"attach 'db_{i}.sqlite' as db{i};\n" for i in range(num_consumers)])

    from_stmt = "\nUNION ALL\n".join(
        [f"    SELECT * FROM db{i}.inflight_taskactivations" for i in range(num_consumers)]
    )
    query = f"""
{query_prelude}
SELECT
    partition,
    (max(offset) - min(offset)) + 1 AS offset_diff,
    count(*) AS occ,
    (max(offset) - min(offset)) + 1 - count(offset) AS delta
FROM (
{from_stmt}
)
GROUP BY partition
ORDER BY partition;
    """
    print(f"DONE!!!\nUse the following query to validate sqlite integrity:\n{query}")


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
    help="Enable dlq to route invalid messages to. See https://getsentry.github.io/arroyo/dlqs.html#arroyo.dlq.DlqPolicy for more information.",
    is_flag=True,
    default=True,
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
@configuration
def basic_consumer(
    consumer_name: str, consumer_args: tuple[str, ...], topic: str | None, **options: Any
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
    from sentry.utils.arroyo import initialize_arroyo_main

    log_level = options.pop("log_level", None)
    if log_level is not None:
        logging.getLogger("arroyo").setLevel(log_level.upper())

    add_global_tags(kafka_topic=topic, consumer_group=options["group_id"])
    initialize_arroyo_main()

    processor = get_stream_processor(consumer_name, consumer_args, topic=topic, **options)
    run_processor_with_signals(processor, consumer_name)


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
    from sentry.utils.arroyo import initialize_arroyo_main

    initialize_arroyo_main()

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
            healthcheck_file_path=None,
            enforce_schema=True,
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
