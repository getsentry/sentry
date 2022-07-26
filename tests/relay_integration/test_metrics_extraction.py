import uuid

import confluent_kafka as kafka

from sentry.tasks.relay import compute_projectkey_config
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import Feature
from sentry.utils import json


class MetricsExtractionTest(RelayStoreHelper, TransactionTestCase):
    def test_all_transaction_metrics_emitted(self):
        with Feature(
            {
                "organizations:transaction-metrics-extraction": True,
                "organizations:performance-ops-breakdown": True,
            }
        ):
            event_data = {
                "type": "transaction",
                "transaction": "foo",
                "timestamp": iso_format(before_now(seconds=1)),
                "start_timestamp": iso_format(before_now(seconds=2)),
                "contexts": {
                    "trace": {
                        "trace_id": 32 * "b",
                        "span_id": 16 * "c",
                        "type": "trace",
                    }
                },
                "user": {"id": "some_user"},
                "measurements": {
                    "fp": {"value": 2258.060000000114},
                    "fcp": {"value": 2258.060000000114},
                    "lcp": {"value": 2807.335},
                    "fid": {"value": 3.4900000027846545},
                    "cls": {"value": 0.0382},
                    "frames_total": {"value": 100},
                    "frames_slow": {"value": 10},
                    "frames_frozen": {"value": 5},
                    "stall_count": {"value": 2},
                    "stall_total_time": {"value": 12},
                    "stall_longest_time": {"value": 7},
                    "app_start_warm": {"value": 0.001},
                    "app_start_cold": {"value": 0.001},
                    "ttfb": {"value": 5},
                    "ttfb.requesttime": {"value": 6},
                },
                "breakdowns": {
                    "span_ops": {
                        "ops.http": {"value": 2039.16049},
                        "ops.db": {"value": 91.876},
                        "ops.resource": {"value": 2024.234772},
                        "ops.browser": {"value": 633.474827},
                        "total.time": {"value": 2875.570536},
                    }
                },
            }

            settings = {
                "bootstrap.servers": "127.0.0.1:9092",  # TODO: read from django settings here
                "group.id": "test-consumer-%s" % uuid.uuid4().hex,
                "enable.auto.commit": True,
                "auto.offset.reset": "earliest",
            }

            consumer = kafka.Consumer(settings)
            consumer.assign([kafka.TopicPartition("ingest-metrics", 0)])

            self.post_and_retrieve_event(event_data)

            metrics_emitted = set()
            for _ in range(10000):
                message = consumer.poll(timeout=0.1)
                if message is None:
                    break
                message = json.loads(message.value())
                if message["project_id"] == self.project.id:
                    print(message)
                    metrics_emitted.add(message["name"])

            print(len(metrics_emitted))
            consumer.close()

            project_config = compute_projectkey_config(self.projectkey)
            extraction_config = project_config["config"]["transactionMetrics"]
            metrics_expected = set(extraction_config["extractMetrics"])

            assert sorted(metrics_emitted) == sorted(metrics_expected)
