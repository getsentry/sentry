import time
import uuid

import confluent_kafka as kafka
import pytest

from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_kafka
from sentry.utils import json

pytestmark = [requires_kafka]


class MetricsExtractionTest(RelayStoreHelper, TransactionTestCase):
    @pytest.mark.skip("breaks in Relay for unknown reasons")
    @override_options({"relay.transaction-names-client-based": 1.0})
    def test_all_transaction_metrics_emitted(self):
        with Feature(
            {
                "organizations:transaction-metrics-extraction": True,
            }
        ):
            event_data = {
                "type": "transaction",
                "transaction": "foo",
                "transaction_info": {"source": "url"},  # 'transaction' tag not extracted
                "timestamp": before_now(seconds=1),
                "start_timestamp": before_now(seconds=2),
                "contexts": {
                    "trace": {
                        "trace_id": 32 * "b",
                        "span_id": 16 * "c",
                        "type": "trace",
                    }
                },
                "user": {"id": 123},
                "measurements": {
                    "fp": {"value": 2258.060000000114},
                    "fcp": {"value": 2258.060000000114},
                    "lcp": {"value": 2807.335},
                    "inp": {"value": 51.318},
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
                "spans": [
                    {
                        "op": op,
                        "trace_id": 32 * "b",
                        "span_id": 16 * "1",
                        "start_timestamp": before_now(seconds=2),
                        "timestamp": before_now(seconds=1),
                    }
                    for op in ("db", "http", "resource", "browser", "ui")
                ],
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

            strings_emitted = set()
            for _ in range(1000):
                message = consumer.poll(timeout=1.0)
                if message is None:
                    break
                message = json.loads(message.value())
                if message["project_id"] == self.project.id:
                    strings_emitted.add(message["name"])
                    for key, value in message["tags"].items():
                        strings_emitted.add(key)
                        strings_emitted.add(value)

            consumer.close()

            #: These strings should be common strings, but we cannot add them
            #: to the indexer because they already exist in the release health
            #: indexer db.
            known_non_common_strings = {
                "other",
                "platform",
                "d:transactions/measurements.inp@millisecond",
            }

            # Make sure that all the standard strings are part of the list of common strings:
            non_common_strings = strings_emitted - SHARED_STRINGS.keys()
            assert non_common_strings == known_non_common_strings

    def test_histogram_outliers(self):
        with Feature(
            {
                "organizations:transaction-metrics-extraction": True,
            }
        ):
            event_data = {
                "type": "transaction",
                "transaction": "foo",
                "transaction_info": {"source": "url"},  # 'transaction' tag not extracted
                "timestamp": before_now(seconds=1).isoformat(),
                "start_timestamp": before_now(seconds=2).isoformat(),
                "platform": "javascript",
                "contexts": {
                    "trace": {
                        "op": "pageload",
                        "trace_id": 32 * "b",
                        "span_id": 16 * "c",
                        "type": "trace",
                    }
                },
                "user": {"id": 123},
                "measurements": {
                    "fcp": {"value": 999999999.0},
                    "lcp": {"value": 0.0},
                },
            }

            settings = {
                "bootstrap.servers": "127.0.0.1:9092",  # TODO: read from django settings here
                "group.id": "test-consumer-%s" % uuid.uuid4().hex,
                "enable.auto.commit": True,
                "auto.offset.reset": "earliest",
            }

            consumer = kafka.Consumer(settings)
            consumer.assign([kafka.TopicPartition("ingest-performance-metrics", 0)])

            self.post_and_retrieve_event(event_data)

            histogram_outlier_tags = {}
            buckets = []
            t0 = time.monotonic()
            for attempt in range(1000):
                message = consumer.poll(timeout=1.0)
                if message is None:
                    break
                bucket = json.loads(message.value())
                buckets.append(bucket)
                try:
                    histogram_outlier_tags[bucket["name"]] = bucket["tags"]["histogram_outlier"]
                except KeyError:
                    pass

            consumer.close()
            assert histogram_outlier_tags == {
                "d:transactions/duration@millisecond": "inlier",
                "d:transactions/measurements.fcp@millisecond": "outlier",
                "d:transactions/measurements.lcp@millisecond": "inlier",
            }, {
                "attempts": attempt,
                "time_elapsed": time.monotonic() - t0,
                "bucket_count": len(buckets),
            }
