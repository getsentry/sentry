# pylint: skip-file
# flake8: noqa

import base64
import datetime
import functools
import itertools
import json
import pprint
import random
import string
import struct

import click
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


def make_counter_payload(use_case, org_id, rand_str, sampling_weight=None):
    return {
        "name": f"c:{use_case}/{use_case}@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
            f"metric_e2e_{use_case}_counter_k_{rand_str}": f"metric_e2e_{use_case}_counter_v_{rand_str}",
        },
        "timestamp": int(datetime.datetime.now(tz=datetime.UTC).timestamp()),
        "type": "c",
        "value": 1,
        "org_id": org_id,
        "retention_days": 90,
        "project_id": 3,
        **({"sampling_weight": sampling_weight} if sampling_weight else {}),
    }


def make_dist_payload(use_case, org_id, rand_str, value_len, b64_encode, sampling_weight=None):
    nums = [random.random() for _ in range(value_len)]
    return {
        "name": f"d:{use_case}/duration@second",
        "tags": {
            "environment": "production",
            "session.status": "healthy",
            f"metric_e2e_{use_case}_dist_k_{rand_str}": f"metric_e2e_{use_case}_dist_v_{rand_str}",
        },
        "timestamp": int(datetime.datetime.now(tz=datetime.UTC).timestamp()),
        "type": "d",
        "value": (
            {
                "format": "base64",
                "data": base64.b64encode(struct.pack(f"<{len(nums)}d", *nums))
                .replace(b"=", b"")
                .decode("ascii"),
            }
            if b64_encode
            else {
                "format": "zstd",
                "data": "KLUv/QBYrQAAcAAA8D8AQAAAAAAAAAhAAgBgRgCw",
            }
        ),
        "org_id": org_id,
        "retention_days": 90,
        "project_id": 3,
        **({"sampling_weight": sampling_weight} if sampling_weight else {}),
    }


def make_set_payload(use_case, org_id, rand_str, value_len, b64_encode, sampling_weight=None):
    INT_WIDTH = 4
    nums = [random.randint(0, 2048) for _ in range(value_len)]
    return {
        "name": f"s:{use_case}/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
            f"metric_e2e_{use_case}_set_k_{rand_str}": f"metric_e2e_{use_case}_set_v_{rand_str}",
        },
        "timestamp": int(datetime.datetime.now(tz=datetime.UTC).timestamp()),
        "type": "s",
        "value": (
            {
                "format": "base64",
                "data": base64.b64encode(
                    b"".join([num.to_bytes(INT_WIDTH, byteorder="little") for num in nums])
                )
                .replace(b"=", b"")
                .decode("ascii"),
            }
            if b64_encode
            else {
                "format": "array",
                "data": nums,
            }
        ),
        "org_id": org_id,
        "retention_days": 90,
        "project_id": 3,
        **({"sampling_weight": sampling_weight} if sampling_weight else {}),
    }


def make_gauge_payload(use_case, org_id, rand_str, sampling_weight):
    return {
        "name": f"s:{use_case}/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
            f"metric_e2e_{use_case}_gauge_k_{rand_str}": f"metric_e2e_{use_case}_gauge_v_{rand_str}",
        },
        "timestamp": int(datetime.datetime.now(tz=datetime.UTC).timestamp()),
        "type": "g",
        "value": {
            "min": 1,
            "max": 1,
            "sum": 1,
            "count": 1,
            "last": 1,
        },
        "org_id": org_id,
        "retention_days": 90,
        "project_id": 3,
        **({"sampling_weight": sampling_weight} if sampling_weight else {}),
    }


def make_psql(rand_str, is_generic):
    return f"""
        SELECT string,
        organization_id,
        {"use_case_id," if is_generic else ""}
        date_added,
        last_seen
        FROM {"sentry_perfstringindexer" if is_generic else "sentry_stringindexer"}
        WHERE string ~ 'metric_e2e_.*{rand_str}';
    """


def make_csql(rand_str, is_generic):
    return "UNION ALL".join(
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
                    "generic_metric_gauges_raw_local",
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


def produce_msgs(messages, is_generic, host, dryrun, quiet):
    conf = {"bootstrap.servers": host}

    producer = KafkaProducer(conf)
    for i, message in enumerate(messages):
        print(f"{i + 1} / {len(messages)}")
        if not quiet:
            pprint.pprint(message)
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
    "--metric-types", default="cdsg", show_default=True, help="The types of metrics to send"
)
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
    "-d",
    is_flag=True,
    default=False,
    show_default=True,
    help="Generate the messages without sending them.",
)
@click.option(
    "--quiet",
    "-q",
    is_flag=True,
    default=False,
    show_default=True,
    help="Disable printing the messages.",
)
@click.option(
    "--start-org-id",
    default=1,
    show_default=True,
    help="Specify which org id(s) to start from.",
)
@click.option(
    "--end-org-id",
    default=1,
    show_default=True,
    help="Specify which org id(s) to end with.",
)
@click.option(
    "--num-bad-msg",
    default=0,
    show_default=True,
    help="Number of additional badly formatted metric messages to send.",
)
@click.option(
    "--value-len",
    default=8,
    show_default=True,
    help="Number of elements for metrics (sets and distributions).",
)
@click.option(
    "--b64-encode",
    default=True,
    show_default=True,
    help="Encode sets and distribution metrics values in base64",
)
@click.option(
    "--sampling-weight",
    type=int,
    default=None,
    show_default=True,
    help="Sampling weight for the metrics",
)
def main(
    metric_types,
    use_cases,
    rand_str,
    host,
    dryrun,
    quiet,
    start_org_id,
    end_org_id,
    num_bad_msg,
    value_len,
    b64_encode,
    sampling_weight,
):
    if UseCaseID.SESSIONS.value in use_cases and len(use_cases) > 1:
        click.secho(
            "ERROR: UseCaseID.SESSIONS is in use_cases and there are more than 1 use cases",
            blink=True,
            bold=True,
        )
        exit(1)

    is_generic = UseCaseID.SESSIONS.value not in use_cases
    metric_types = "".join(set(metric_types))
    rand_str = rand_str or "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    payload_generators = {
        "c": functools.partial(
            make_counter_payload, rand_str=rand_str, sampling_weight=sampling_weight
        ),
        "d": functools.partial(
            make_dist_payload,
            rand_str=rand_str,
            value_len=value_len,
            b64_encode=b64_encode,
            sampling_weight=sampling_weight,
        ),
        "s": functools.partial(
            make_set_payload,
            rand_str=rand_str,
            value_len=value_len,
            b64_encode=b64_encode,
            sampling_weight=sampling_weight,
        ),
        "g": functools.partial(
            make_gauge_payload, rand_str=rand_str, sampling_weight=sampling_weight
        ),
    }

    messages = list(
        itertools.chain.from_iterable(
            (
                payload_generators[metric_type](use_case=use_case, org_id=org_id)
                for metric_type in metric_types
            )
            for use_case in use_cases
            for org_id in range(start_org_id, end_org_id + 1)
        )
    )
    messages.extend([{"BAD_VALUE": rand_str, "idx": i} for i in range(num_bad_msg)])

    random.shuffle(messages)
    produce_msgs(messages, is_generic, host, dryrun, quiet)

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
            f"there should be {len(metric_types)} metrics for each use cases, "
            f"{len(metric_types) * len(use_cases) * (end_org_id - start_org_id + 1)} in total."
        )
        print(make_csql(rand_str, is_generic))


if __name__ == "__main__":
    main()
