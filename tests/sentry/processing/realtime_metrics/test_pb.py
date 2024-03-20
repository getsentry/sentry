from sentry.processing.realtime_metrics.pb import PbRealtimeMetricsStore


def test_invalid_target():
    # there is no grpc service at that addr
    store = PbRealtimeMetricsStore(target="localhost:12345")
    store.record_project_duration(1, 123456789)
    assert not store.is_lpq_project(1)


def test_pb_works(peanutbutter_server):
    store = PbRealtimeMetricsStore(target=peanutbutter_server["target"])

    assert not store.is_lpq_project(1)
    store.record_project_duration(1, 123456789)
    assert store.is_lpq_project(1)
