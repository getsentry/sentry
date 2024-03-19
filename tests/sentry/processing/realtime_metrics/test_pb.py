from sentry.processing.realtime_metrics.pb import PbRealtimeMetricsStore


def test_invalid_target():
    # there is no grpc service at that addr
    store = PbRealtimeMetricsStore(target="localhost:12345")
    store.record_project_duration(1, 123456789)
    assert not store.is_lpq_project(1)


def test_pb_works():
    # TODO: need to properly hook the service up, thus far this needs to run
    # locally for the test to pass.
    store = PbRealtimeMetricsStore(target="localhost:50051")

    assert not store.is_lpq_project(1)
    store.record_project_duration(1, 123456789)
    assert store.is_lpq_project(1)
