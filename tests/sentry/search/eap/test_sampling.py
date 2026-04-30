from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta

from sentry.search.eap.sampling import events_meta_from_rpc_request_meta


def test_events_meta_bytes_scanned_and_full_scan() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 5_000_000
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = False
    qi = rpc_meta.query_info.add()
    qi.stats.progress_bytes = 100
    qi.stats.rows_read = 1

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert result["bytes_scanned"] == 100
    assert result["full_scan"] is True
    assert result["fields"] == {}
    # Row estimate is not exposed; only derived hint when rows_read and bytes are positive.
    assert result["estimated_total_bytes"] == 5_000_000 * 100


def test_events_meta_partial_scan_when_higher_accuracy_available() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = True
    qi = rpc_meta.query_info.add()
    qi.stats.progress_bytes = 1

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert result["full_scan"] is False
    assert result["bytes_scanned"] == 1


def test_events_meta_estimated_total_bytes_sums_query_info() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 10_000
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = False
    qi1 = rpc_meta.query_info.add()
    qi1.stats.progress_bytes = 200
    qi1.stats.rows_read = 100
    qi2 = rpc_meta.query_info.add()
    qi2.stats.progress_bytes = 300
    qi2.stats.rows_read = 50

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert result["bytes_scanned"] == 500
    # 10_000 * (500 / 150)
    assert result["estimated_total_bytes"] == 33_333


def test_events_meta_omits_estimated_total_bytes_when_estimated_num_rows_zero() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 0
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = True
    qi = rpc_meta.query_info.add()
    qi.stats.progress_bytes = 50
    qi.stats.rows_read = 10

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert "estimated_total_bytes" not in result
    assert result["bytes_scanned"] == 50


def test_events_meta_omits_estimated_total_bytes_when_rows_read_zero() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 1_000
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = False
    qi = rpc_meta.query_info.add()
    qi.stats.progress_bytes = 100
    qi.stats.rows_read = 0

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert "estimated_total_bytes" not in result


def test_events_meta_omits_estimated_total_bytes_when_bytes_scanned_zero() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 1_000
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = False
    qi = rpc_meta.query_info.add()
    qi.stats.progress_bytes = 0
    qi.stats.rows_read = 10

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert result["bytes_scanned"] == 0
    assert "estimated_total_bytes" not in result


def test_events_meta_omits_estimated_total_bytes_without_query_info() -> None:
    rpc_meta = ResponseMeta()
    rpc_meta.downsampled_storage_meta.estimated_num_rows = 1_000_000
    rpc_meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier = False

    result = events_meta_from_rpc_request_meta(rpc_meta)

    assert result.get("bytes_scanned") is None
    assert "estimated_total_bytes" not in result
