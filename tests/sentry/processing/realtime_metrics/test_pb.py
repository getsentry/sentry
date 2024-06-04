from math import floor
from random import random

from sentry.processing.realtime_metrics.pb import PbRealtimeMetricsStore


def test_invalid_target():
    # there is no grpc service at that addr
    store = PbRealtimeMetricsStore(target="http://localhost:12345")
    store.record_project_duration(1, 123456789)
    assert not store.is_lpq_project(1)


def test_pb_works():
    store = PbRealtimeMetricsStore(target="http://localhost:4433")

    project_id = floor(random() * (1 << 32))
    assert not store.is_lpq_project(project_id)
    store.record_project_duration(project_id, 123456789)
    assert store.is_lpq_project(project_id)
