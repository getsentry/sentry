# pylint: skip-file
# flake8: noqa

import datetime
import itertools
import json
import pprint
import random
import string

import click
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic

from sentry.sentry_metrics.use_case_id_registry import UseCaseID

make_counter_payload = lambda use_case, org_id, rand_str: {
    "name": f"c:{use_case}/{use_case}@none",
    "tags": {
        "environment": "production",
        "session.status": "init",
        f"metric_e2e_{use_case}_counter_k_{rand_str}": f"metric_e2e_{use_case}_counter_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "c",
    "value": 1,
    "org_id": org_id,
    "retention_days": 90,
    "project_id": 3,
}

make_dist_payload = lambda use_case, org_id, rand_str, value_len: {
    "name": f"d:{use_case}/duration@second",
    "tags": {
        "environment": "production",
        "session.status": "healthy",
        f"metric_e2e_{use_case}_dist_k_{rand_str}": f"metric_e2e_{use_case}_dist_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "d",
    "value": [i for i in range(value_len)],
    "org_id": org_id,
    "retention_days": 90,
    "project_id": 3,
}

make_set_payload = lambda use_case, org_id, rand_str, value_len: {
    "name": f"s:{use_case}/error@none",
    "tags": {
        "environment": "production",
        "session.status": "errored",
        f"metric_e2e_{use_case}_set_k_{rand_str}": f"metric_e2e_{use_case}_set_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "s",
    "value": [i for i in range(value_len)],
    "org_id": org_id,
    "retention_days": 90,
    "project_id": 3,
}

make_psql = (
    lambda rand_str, is_generic: f"""
    SELECT string,
       organization_id,
       {"use_case_id," if is_generic else ""}
       date_added,
       last_seen
    FROM {"sentry_perfstringindexer" if is_generic else "sentry_stringindexer"}
    WHERE string ~ 'metric_e2e_.*{rand_str}';
"""
)


make_csql = lambda rand_str, is_generic: "UNION ALL".join(
    [
        f"""
    SELECT use_case_id,
        org_id,
        project_id,
        metric_id,
        timestamp,
        tags.key,
        tags.raw_value
    FROM {table_name}
    WHERE arrayExists(v -> match(v, 'metric_e2e_.*{rand_str}'), tags.raw_value)
    """
        for table_name in (
            [
                "generic_metric_counters_raw_local",
                "generic_metric_distributions_raw_local",
                "generic_metric_sets_raw_local",
            ]
            if is_generic
            else [
                "metrics_counters_v2_local",
                "metrics_distributions_v2_local",
                "metrics_sets_v2_local",
            ]
        )
    ]
)


def produce_msgs(messages, is_generic, host, dryrun):
    conf = {"bootstrap.servers": host}

    producer = KafkaProducer(conf)
    for i, message in enumerate(messages):
        print(f"{i + 1} / {len(messages)}")
        # pprint.pprint(message)
        if not dryrun:
            producer.produce(
                Topic(name=("ingest-performance-metrics" if is_generic else "ingest-metrics")),
                KafkaPayload(key=None, value=json.dumps(message).encode("utf-8"), headers=[]),
            )
            print("Done")
        print()

    producer.close()


@click.command()
@click.option(
    "--use-cases",
    multiple=True,
    default=[
        use_case_id.value for use_case_id in UseCaseID if use_case_id is not UseCaseID.SESSIONS
    ],
    show_default=True,
    help="The use case IDs.",
)
@click.option("--rand-str", default=None, help="The random string prefix for each key value pairs.")
@click.option(
    "--host", default="127.0.0.1:9092", show_default=True, help="The host and port for kafka."
)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    show_default=True,
    help="Print the messages without sending them.",
)
@click.option(
    "--start-org-id",
    default=1,
    show_default=True,
    help="Specify which org id(s) to start from",
)
@click.option(
    "--end-org-id",
    default=1,
    show_default=True,
    help="Specify which org id(s) to end with",
)
@click.option(
    "--num-bad-msg",
    default=0,
    show_default=True,
    help="Number of additional badly formatted metric messages to send",
)
@click.option(
    "--value-len",
    default=6,
    show_default=True,
    help="Number of elements for metrics (sets and distributions)",
)
def main(use_cases, rand_str, host, dryrun, start_org_id, end_org_id, num_bad_msg, value_len):
    if UseCaseID.SESSIONS.value in use_cases and len(use_cases) > 1:
        click.secho(
            "ERROR: UseCaseID.SESSIONS is in use_cases and there are more than 1 use cases",
            blink=True,
            bold=True,
        )
        exit(1)

    rand_str = rand_str or "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    is_generic = UseCaseID.SESSIONS.value not in use_cases

    messages = list(
        itertools.chain.from_iterable(
            (
                make_counter_payload(use_case, org, rand_str),
                make_dist_payload(use_case, org, rand_str, value_len),
                make_set_payload(use_case, org, rand_str, value_len),
            )
            for use_case in use_cases
            for org in range(start_org_id, end_org_id + 1)
        )
    )

    messages.extend([{"BAD_VALUE": rand_str, "idx": i} for i in range(num_bad_msg)])

    random.shuffle(messages)

    produce_msgs(messages, is_generic, host, dryrun)

    metrics_per_use_case = 3
    strs_per_use_case = 3

    print(
        f"Use the following SQL to verify postgres, "
        f"there should be {strs_per_use_case} strings for each use cases, "
        f"{strs_per_use_case * len(use_cases) * (end_org_id - start_org_id + 1)} in total."
    )
    print(make_psql(rand_str, is_generic))

    if is_generic:
        print(
            f"Use the following SQL to verify clickhouse, "
            f"there should be {metrics_per_use_case} metrics for each use cases, "
            f"{metrics_per_use_case * len(use_cases) * (end_org_id - start_org_id + 1)} in total."
        )
        print(make_csql(rand_str, is_generic))


if __name__ == "__main__":
    main()
