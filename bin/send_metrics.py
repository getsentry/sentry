# pylint: skip-file
# flake8: noqa

"""
Script that sends generic metrics messages to sentry locally


Overview

This script is designed to be used when creating a new use case ID for the first
time for the generic metrics platform.


Usage


python send_metrics.py

Without any command line argument, the script will send 3 metrics
(counter/set/distribution) for each use case ID registered in
src/sentry/sentry_metrics/use_case_id_registry.py.


python send_metrics.py hello world

The script will treat any arguments supplied as a use case ID, and send 3 metrics
(counter/set/distribution) for each use case ID specified.

"""

import datetime
import itertools
import json
import pprint
import random
import string
import sys

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import Topic

from sentry.sentry_metrics.use_case_id_registry import UseCaseID

BOOTSTRAP_HOST = "127.0.0.1:9092"
TOPIC_NAME = "ingest-performance-metrics"

conf = {"bootstrap.servers": BOOTSTRAP_HOST}

make_counter_payload = lambda use_case, rand_str: {
    "name": f"c:{use_case}/{use_case}@none",
    "tags": {
        "environment": "production",
        "session.status": "init",
        f"gen_metric_e2e_{use_case}_counter_k_{rand_str}": f"gen_metric_e2e_{use_case}_counter_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "c",
    "value": 1,
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}

make_dist_payload = lambda use_case, rand_str: {
    "name": f"d:{use_case}/duration@second",
    "tags": {
        "environment": "production",
        "session.status": "healthy",
        f"gen_metric_e2e_{use_case}_dist_k_{rand_str}": f"gen_metric_e2e_{use_case}_dist_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "d",
    "value": [4, 5, 6],
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}

make_set_payload = lambda use_case, rand_str: {
    "name": f"s:{use_case}/error@none",
    "tags": {
        "environment": "production",
        "session.status": "errored",
        f"gen_metric_e2e_{use_case}_set_k_{rand_str}": f"gen_metric_e2e_{use_case}_set_v_{rand_str}",
    },
    "timestamp": int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp()),
    "type": "s",
    "value": [3],
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}

make_psql = (
    lambda rand_str: f"""
    SELECT string,
       organization_id,
       date_added,
       use_case_id
    FROM sentry_perfstringindexer
    WHERE string ~ 'gen_metric_e2e_.*{rand_str}';
"""
)

make_csql = lambda rand_str: "UNION ALL".join(
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
    WHERE arrayExists(v -> match(v, 'gen_metric_e2e_.*{rand_str}'), tags.raw_value)
    """
        for table_name in [
            "generic_metric_counters_raw_local",
            "generic_metric_distributions_raw_local",
            "generic_metric_sets_raw_local",
        ]
    ]
)


def produce_msgs(messages):
    producer = KafkaProducer(conf)
    for i, message in enumerate(messages):
        print(f"Sending message {i + 1} of {len(messages)}:")
        pprint.pprint(message)
        producer.produce(
            Topic(name=TOPIC_NAME),
            KafkaPayload(key=None, value=json.dumps(message).encode("utf-8"), headers=[]),
        )
        print("Done")
        print()

    producer.close()


if __name__ == "__main__":
    rand_str = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    use_cases = (
        [use_case_id.value for use_case_id in UseCaseID if use_case_id is not UseCaseID.SESSIONS]
        if len(sys.argv) == 1
        else sys.argv[1:]
    )
    messages = list(
        itertools.chain.from_iterable(
            (
                make_counter_payload(use_case, rand_str),
                make_dist_payload(use_case, rand_str),
                make_set_payload(use_case, rand_str),
            )
            for use_case in use_cases
        )
    )
    random.shuffle(messages)

    produce_msgs(messages)
    print(
        f"Use the following SQL to verify postgres, there should be {(strs_per_use_case := 6)} strings for each use cases, {strs_per_use_case * len(use_cases)} in total."
    )
    print(make_psql(rand_str))
    print(
        f"Use the following SQL to verify clickhouse, there should be {(metrics_per_use_case := 3)} metrics for each use cases, {metrics_per_use_case * len(use_cases)} in total."
    )
    print(make_csql(rand_str))
