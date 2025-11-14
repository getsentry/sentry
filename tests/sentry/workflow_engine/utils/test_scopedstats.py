import time
from collections.abc import Callable
from typing import int, Any

import pytest

from sentry.workflow_engine.utils.scopedstats import Recorder, incr, timer


def test_basic_increment() -> None:
    # Test new Recorder API pattern
    recorder = Recorder()

    with recorder.record():
        incr("test_key")
        incr("test_key", amount=5)

    result = recorder.get_result()
    assert result["test_key"] == 6
    assert "total_recording_duration" in result
    assert isinstance(result["total_recording_duration"], float)


def test_increment_with_tags() -> None:
    # Test new Recorder API with tag filtering
    recorder = Recorder()

    with recorder.record():
        incr("requests", tags={"status": "success"})
        incr("requests", tags={"status": "error"}, amount=2)
        incr("requests", tags={"status": "success"}, amount=3)

    result = recorder.get_result()
    assert result["requests"] == 6
    assert "total_recording_duration" in result
    assert isinstance(result["total_recording_duration"], float)

    success_only = recorder.get_result(tag_filter={"status": "success"})
    assert success_only == {"requests": 4}

    error_only = recorder.get_result(tag_filter={"status": "error"})
    assert error_only == {"requests": 2}


def test_multiple_keys() -> None:
    recorder = Recorder()

    with recorder.record():
        incr("key1", amount=10)
        incr("key2", amount=20)
        incr("key1", amount=5)

    result = recorder.get_result()
    assert result["key1"] == 15
    assert result["key2"] == 20
    assert "total_recording_duration" in result


def test_nested_contexts() -> None:
    stats1 = Recorder()
    stats2 = Recorder()

    with stats1.record():
        incr("shared_key", amount=1)
        with stats2.record():
            incr("shared_key", amount=2)
        incr("shared_key", amount=4)

    # With the new stack-based approach, nested stats bubble up to the outer context
    result1 = stats1.get_result()
    assert result1["shared_key"] == 7
    assert "total_recording_duration" in result1

    # stats2 gets its data when its context exits, which includes only what happened within it
    result2 = stats2.get_result()
    assert result2["shared_key"] == 2
    assert "total_recording_duration" in result2


def test_no_active_context() -> None:
    incr("key1", amount=100)

    stats = Recorder()
    result = stats.get_result()
    assert result == {}


def test_complex_tag_filtering() -> None:
    stats = Recorder()

    with stats.record():
        incr("api_calls", tags={"method": "GET", "status": "200"}, amount=10)
        incr("api_calls", tags={"method": "POST", "status": "200"}, amount=5)
        incr("api_calls", tags={"method": "GET", "status": "404"}, amount=2)
        incr("api_calls", tags={"method": "POST", "status": "500"}, amount=1)

    all_calls = stats.get_result()
    assert all_calls["api_calls"] == 18
    assert "total_recording_duration" in all_calls

    success_calls = stats.get_result(tag_filter={"status": "200"})
    assert success_calls == {"api_calls": 15}

    get_calls = stats.get_result(tag_filter={"method": "GET"})
    assert get_calls == {"api_calls": 12}

    get_success = stats.get_result(tag_filter={"method": "GET", "status": "200"})
    assert get_success == {"api_calls": 10}


def test_empty_stats() -> None:
    stats = Recorder()
    result = stats.get_result()
    assert result == {}

    filtered = stats.get_result(tag_filter={"nonexistent": "tag"})
    assert filtered == {}


def test_timer_decorator_default_key() -> None:
    recorder = Recorder()

    @timer()
    def slow_function() -> str:
        time.sleep(0.01)
        return "result"

    with recorder.record():
        result = slow_function()
        slow_function()

    assert result == "result"
    stats_data = recorder.get_result()
    expected_key_base = fn_key(slow_function)
    assert f"{expected_key_base}.count" in stats_data
    assert f"{expected_key_base}.total_dur" in stats_data
    assert stats_data[f"{expected_key_base}.count"] == 2
    assert stats_data[f"{expected_key_base}.total_dur"] >= 0.02
    # Check total_recording_duration exists and is reasonable
    assert "total_recording_duration" in stats_data
    assert stats_data["total_recording_duration"] >= 0.02


def test_timer_decorator_custom_key() -> None:
    recorder = Recorder()

    @timer(key="custom_timer")
    def fast_function() -> int:
        return 42

    with recorder.record():
        result = fast_function()
        fast_function()
        fast_function()

    assert result == 42
    stats_data = recorder.get_result()
    assert stats_data["custom_timer.count"] == 3
    assert "custom_timer.total_dur" in stats_data


def test_timer_decorator_with_tags() -> None:
    recorder = Recorder()

    @timer(key="api_call", tags={"service": "user"})
    def api_call() -> str:
        time.sleep(0.005)
        return "data"

    with recorder.record():
        api_call()
        api_call()

    stats_data = recorder.get_result()
    assert stats_data["api_call.count"] == 2

    service_stats = recorder.get_result(tag_filter={"service": "user"})
    assert service_stats["api_call.count"] == 2
    assert service_stats["api_call.total_dur"] >= 0.01


def fn_key(fn: Callable[..., Any]) -> str:
    return f"calls.{fn.__qualname__}"


def test_timer_decorator_standalone() -> None:
    """Test @timer (without parentheses) works."""
    recorder = Recorder()

    @timer()
    def standalone_function() -> str:
        time.sleep(0.001)
        return "standalone"

    with recorder.record():
        result = standalone_function()

    assert result == "standalone"
    stats_data = recorder.get_result()
    expected_key_base = fn_key(standalone_function)
    assert stats_data[f"{expected_key_base}.count"] == 1
    assert stats_data[f"{expected_key_base}.total_dur"] >= 0.001


def test_timer_decorator_no_active_context() -> None:
    @timer()
    def no_context_function() -> str:
        return "no stats"

    result = no_context_function()
    assert result == "no stats"

    stats = Recorder()
    assert stats.get_result() == {}


def test_timer_decorator_exception_handling() -> None:
    stats = Recorder()

    @timer(key="error_prone")
    def failing_function() -> None:
        time.sleep(0.005)
        raise ValueError("Test error")

    with stats.record():
        with pytest.raises(ValueError):
            failing_function()

    stats_data = stats.get_result()
    assert stats_data["error_prone.count"] == 1
    assert stats_data["error_prone.total_dur"] >= 0.005


def test_timer_nested_contexts() -> None:
    stats1 = Recorder()
    stats2 = Recorder()

    @timer(key="nested_timer")
    def nested_function() -> str:
        time.sleep(0.005)
        return "nested"

    with stats1.record():
        nested_function()  # count=1 in collector1
        with stats2.record():
            nested_function()  # count=1 in collector2, then merges to collector1
        nested_function()  # count=1 more in collector1

    # stats1 gets all 3 calls (1 + 1 from nested + 1 more)
    assert stats1.get_result()["nested_timer.count"] == 3
    # stats2 gets only the call that happened within its context
    assert stats2.get_result()["nested_timer.count"] == 1


def test_timer_decorator_variations() -> None:
    stats = Recorder()

    @timer(key="manual_timer")
    def manual_operation() -> None:
        time.sleep(0.01)

    @timer(key="tagged_timer", tags={"operation": "test"})
    def tagged_operation() -> None:
        time.sleep(0.005)

    with stats.record():
        manual_operation()
        tagged_operation()

    stats_data = stats.get_result()
    assert stats_data["manual_timer.count"] == 1
    assert stats_data["manual_timer.total_dur"] >= 0.01
    assert stats_data["tagged_timer.count"] == 1
    assert stats_data["tagged_timer.total_dur"] >= 0.005

    tagged_only = stats.get_result(tag_filter={"operation": "test"})
    assert "manual_timer.count" not in tagged_only
    assert tagged_only["tagged_timer.count"] == 1


def test_timer_decorator_no_active_stats() -> None:
    @timer()
    def no_stats_operation() -> None:
        time.sleep(0.001)

    # Call without any active Recorder context
    no_stats_operation()

    stats = Recorder()
    assert stats.get_result() == {}


def test_timer_decorator_exception_handling_duplicate() -> None:
    stats = Recorder()

    @timer(key="exception_timer")
    def exception_operation() -> None:
        time.sleep(0.005)
        raise ValueError("Test exception")

    with stats.record():
        with pytest.raises(ValueError):
            exception_operation()

    stats_data = stats.get_result()
    assert stats_data["exception_timer.count"] == 1
    assert stats_data["exception_timer.total_dur"] >= 0.005


def test_timer_decorator_nested_calls() -> None:
    stats = Recorder()

    @timer(key="inner_timer")
    def inner_operation() -> None:
        time.sleep(0.005)

    @timer(key="outer_timer")
    def outer_operation() -> None:
        time.sleep(0.005)
        inner_operation()  # Nested timer call

    with stats.record():
        outer_operation()

    stats_data = stats.get_result()
    assert stats_data["outer_timer.count"] == 1
    assert stats_data["inner_timer.count"] == 1
    assert stats_data["outer_timer.total_dur"] >= 0.01  # Includes inner time
    assert stats_data["inner_timer.total_dur"] >= 0.005


def test_stack_based_isolation() -> None:
    """Test that the new stack-based approach provides proper isolation."""
    stats_outer = Recorder()
    stats_middle = Recorder()
    stats_inner = Recorder()

    with stats_outer.record():
        incr("level", amount=1)  # Goes to outer collector

        with stats_middle.record():
            incr("level", amount=2)  # Goes to middle collector

            with stats_inner.record():
                incr("level", amount=3)  # Goes to inner collector

            # At this point inner exits: inner gets 3, middle collector gets 3 added
            incr("level", amount=4)  # Goes to middle collector (now has 2+3+4=9)

        # At this point middle exits: middle gets 9, outer collector gets 9 added
        incr("level", amount=5)  # Goes to outer collector (now has 1+9+5=15)

    # At this point outer exits: outer gets 15

    # Each Recorder contains exactly what was collected within its direct scope
    inner_result = stats_inner.get_result()
    assert inner_result["level"] == 3
    assert "total_recording_duration" in inner_result

    middle_result = stats_middle.get_result()
    assert middle_result["level"] == 9  # 2 + 3 + 4
    assert "total_recording_duration" in middle_result

    outer_result = stats_outer.get_result()
    assert outer_result["level"] == 15  # 1 + 9 + 5
    assert "total_recording_duration" in outer_result


def test_no_cross_contamination() -> None:
    """Test that separate Recorder instances don't interfere."""
    stats_a = Recorder()
    stats_b = Recorder()

    with stats_a.record():
        incr("counter_a", amount=10)

    with stats_b.record():
        incr("counter_b", amount=20)

    result_a = stats_a.get_result()
    assert result_a["counter_a"] == 10
    assert "total_recording_duration" in result_a

    result_b = stats_b.get_result()
    assert result_b["counter_b"] == 20
    assert "total_recording_duration" in result_b
