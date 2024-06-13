from math import floor
from random import random

from sentry.lang.native.symbolicator import SymbolicatorPlatform
from sentry.processing.realtime_metrics.pb import PbRealtimeMetricsStore


def test_invalid_target():
    # there is no grpc service at that addr
    store = PbRealtimeMetricsStore(target="http://localhost:12345")
    store.record_project_duration(SymbolicatorPlatform.native, 1, 123456789)
    assert not store.is_lpq_project(SymbolicatorPlatform.native, 1)


def test_pb_works():
    store = PbRealtimeMetricsStore(target="http://localhost:4433")

    project_id = floor(random() * (1 << 32))
    assert not store.is_lpq_project(SymbolicatorPlatform.native, project_id)
    store.record_project_duration(SymbolicatorPlatform.native, project_id, 123456789)
    assert store.is_lpq_project(SymbolicatorPlatform.native, project_id)
