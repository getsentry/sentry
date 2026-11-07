from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path
from unittest import mock

import pytest

from sentry.spans.consumers.process import memory
from sentry.spans.consumers.process.memory import (
    ProcessMemoryReporter,
    parse_process_status,
    read_process_memory,
)
from sentry.testutils.helpers.options import override_options

# /proc/self/status of a Python process on Linux 6.x.
STATUS_LINUX_6 = b"""\
Name:\tpython
Umask:\t0022
State:\tR (running)
Tgid:\t2839
Ngid:\t0
Pid:\t2839
PPid:\t2838
TracerPid:\t0
Uid:\t0\t0\t0\t0
Gid:\t0\t0\t0\t0
FDSize:\t64
Groups:\t
NStgid:\t2839
NSpid:\t2839
NSpgid:\t2839
NSsid:\t2838
Kthread:\t0
VmPeak:\t   36752 kB
VmSize:\t   36736 kB
VmLck:\t       0 kB
VmPin:\t       0 kB
VmHWM:\t   11424 kB
VmRSS:\t   11404 kB
RssAnon:\t    3712 kB
RssFile:\t    7692 kB
RssShmem:\t       0 kB
VmData:\t    5840 kB
VmStk:\t     140 kB
VmExe:\t   22788 kB
VmLib:\t     500 kB
VmPTE:\t      92 kB
VmSwap:\t       0 kB
HugetlbPages:\t       0 kB
CoreDumping:\t0
THP_enabled:\t1
untag_mask:\t0xffffffffffffffff
Threads:\t1
SigQ:\t0/64276
SigPnd:\t0000000000000000
ShdPnd:\t0000000000000000
SigBlk:\t0000000000000000
SigIgn:\t0000000001001000
SigCgt:\t0000000000000002
CapInh:\t0000000000000000
CapPrm:\t000001fffeffffff
CapEff:\t000001fffeffffff
CapBnd:\t000001fffeffffff
CapAmb:\t0000000000000000
NoNewPrivs:\t0
Seccomp:\t0
Seccomp_filters:\t0
Speculation_Store_Bypass:\tthread vulnerable
SpeculationIndirectBranch:\tconditional enabled
Cpus_allowed:\tf
Cpus_allowed_list:\t0-3
Mems_allowed:\t00000000,00000001
Mems_allowed_list:\t0
voluntary_ctxt_switches:\t1
nonvoluntary_ctxt_switches:\t1
"""

# Kernels before 4.5 have no RssAnon, RssFile or RssShmem lines.
STATUS_LINUX_3 = b"""\
Name:\tpython
State:\tS (sleeping)
Pid:\t1
VmPeak:\t  912340 kB
VmSize:\t  912336 kB
VmHWM:\t  204800 kB
VmRSS:\t  150528 kB
VmData:\t  180224 kB
Threads:\t4
"""

MEMORY = {"rss": 4096, "rss_anon": 3072, "rss_file": 1024, "peak_rss": 8192}


def test_parse_process_status() -> None:
    assert parse_process_status(STATUS_LINUX_6) == {
        "rss": 11404 * 1024,
        "rss_anon": 3712 * 1024,
        "rss_file": 7692 * 1024,
        "peak_rss": 11424 * 1024,
    }


def test_parse_process_status_without_rss_breakdown() -> None:
    assert parse_process_status(STATUS_LINUX_3) == {
        "rss": 150528 * 1024,
        "peak_rss": 204800 * 1024,
    }


@pytest.mark.parametrize(
    "content",
    [
        pytest.param(b"", id="empty"),
        pytest.param(b"VmRSS:\n", id="no-value"),
        pytest.param(b"VmRSS:\t12x kB\n", id="not-a-number"),
        pytest.param(b"VmRSS:\t-12 kB\n", id="negative"),
        pytest.param(b"VmRSS:\t12 MB\n", id="wrong-unit"),
        pytest.param(b"VmRSS:\t12\n", id="no-unit"),
        pytest.param(b"VmRSS:\t12 kB extra\n", id="extra-field"),
        pytest.param(b"VmRSS 12 kB\n", id="no-colon"),
        pytest.param(b"\xff\xfe\x00garbage", id="binary"),
    ],
)
def test_parse_process_status_skips_malformed_lines(content: bytes) -> None:
    assert parse_process_status(content) == {}


def test_parse_process_status_keeps_valid_fields_next_to_malformed_ones() -> None:
    content = b"VmRSS:\tlots kB\nRssAnon:\t   10 kB\nRssFile 3 kB\nVmHWM:\t   20 kB\n"

    assert parse_process_status(content) == {"rss_anon": 10 * 1024, "peak_rss": 20 * 1024}


def test_read_process_memory_reads_status_file(tmp_path: Path) -> None:
    status = tmp_path / "status"
    status.write_bytes(STATUS_LINUX_6)

    with (
        mock.patch.object(memory, "_IS_LINUX", True),
        mock.patch.object(memory, "_STATUS_PATH", str(status)),
    ):
        assert read_process_memory() == parse_process_status(STATUS_LINUX_6)


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="reads /proc")
def test_read_process_memory_reads_own_process() -> None:
    process_memory = read_process_memory()

    assert set(process_memory) == {"rss", "rss_anon", "rss_file", "peak_rss"}
    assert 0 < process_memory["rss"] <= process_memory["peak_rss"]


def test_read_process_memory_missing_file(tmp_path: Path) -> None:
    with (
        mock.patch.object(memory, "_IS_LINUX", True),
        mock.patch.object(memory, "_STATUS_PATH", str(tmp_path / "missing")),
    ):
        assert read_process_memory() == {}


def test_read_process_memory_unreadable_path(tmp_path: Path) -> None:
    # A directory cannot be opened as a file.
    with (
        mock.patch.object(memory, "_IS_LINUX", True),
        mock.patch.object(memory, "_STATUS_PATH", str(tmp_path)),
    ):
        assert read_process_memory() == {}


def test_read_process_memory_other_platforms() -> None:
    with (
        mock.patch.object(memory, "_IS_LINUX", False),
        mock.patch("builtins.open") as mock_open,
    ):
        assert read_process_memory() == {}

    mock_open.assert_not_called()


@pytest.fixture
def clock() -> Iterator[mock.Mock]:
    with mock.patch.object(memory, "monotonic", return_value=1000.0) as fake_monotonic:
        yield fake_monotonic


@pytest.fixture
def read_memory() -> Iterator[mock.Mock]:
    with mock.patch.object(memory, "read_process_memory", return_value=MEMORY) as fake_read:
        yield fake_read


@pytest.fixture
def gauge() -> Iterator[mock.Mock]:
    with mock.patch("sentry.spans.consumers.process.memory.metrics.gauge") as fake_gauge:
        yield fake_gauge


def test_reporter_emits_gauges(clock: mock.Mock, read_memory: mock.Mock, gauge: mock.Mock) -> None:
    reporter = ProcessMemoryReporter("flusher", [3, 7])

    with override_options({"spans.buffer.memory-metrics-interval-seconds": 10}):
        reporter.maybe_report()

    tags = {"buffer_component": "flusher", "shards": "3,7"}
    assert gauge.call_args_list == [
        mock.call("spans.buffer.process_memory.rss", 4096, tags=tags, sample_rate=1.0, unit="byte"),
        mock.call(
            "spans.buffer.process_memory.rss_anon", 3072, tags=tags, sample_rate=1.0, unit="byte"
        ),
        mock.call(
            "spans.buffer.process_memory.rss_file", 1024, tags=tags, sample_rate=1.0, unit="byte"
        ),
        mock.call(
            "spans.buffer.process_memory.peak_rss", 8192, tags=tags, sample_rate=1.0, unit="byte"
        ),
    ]


def test_reporter_emits_nothing_without_memory(clock: mock.Mock, gauge: mock.Mock) -> None:
    reporter = ProcessMemoryReporter("consumer", [0])

    with (
        mock.patch.object(memory, "read_process_memory", return_value={}),
        override_options({"spans.buffer.memory-metrics-interval-seconds": 10}),
    ):
        reporter.maybe_report()

    gauge.assert_not_called()


def test_reporter_rate_limits(clock: mock.Mock, read_memory: mock.Mock, gauge: mock.Mock) -> None:
    reporter = ProcessMemoryReporter("consumer", [0, 1])

    with override_options({"spans.buffer.memory-metrics-interval-seconds": 10}):
        reporter.maybe_report()
        assert read_memory.call_count == 1

        clock.return_value = 1009.9
        reporter.maybe_report()
        reporter.maybe_report()
        assert read_memory.call_count == 1

        clock.return_value = 1010.0
        reporter.maybe_report()
        assert read_memory.call_count == 2

        clock.return_value = 1015.0
        reporter.maybe_report()
        assert read_memory.call_count == 2

        # The next report is due 10 seconds after the last one, not on a fixed grid.
        clock.return_value = 1031.0
        reporter.maybe_report()
        assert read_memory.call_count == 3

        clock.return_value = 1040.0
        reporter.maybe_report()
        assert read_memory.call_count == 3

    assert gauge.call_count == 3 * len(MEMORY)


def test_reporter_reads_option_only_when_due(clock: mock.Mock, read_memory: mock.Mock) -> None:
    reporter = ProcessMemoryReporter("consumer", [0])

    with mock.patch(
        "sentry.spans.consumers.process.memory.options.get", return_value=10
    ) as options_get:
        for _ in range(100):
            reporter.maybe_report()
        assert options_get.call_count == 1

        clock.return_value = 1010.0
        for _ in range(100):
            reporter.maybe_report()
        assert options_get.call_count == 2

    options_get.assert_called_with("spans.buffer.memory-metrics-interval-seconds")


def test_reporter_zero_interval_disables(
    clock: mock.Mock, read_memory: mock.Mock, gauge: mock.Mock
) -> None:
    reporter = ProcessMemoryReporter("flusher", [0])

    with override_options({"spans.buffer.memory-metrics-interval-seconds": 0}):
        reporter.maybe_report()
        clock.return_value = 1010.0
        reporter.maybe_report()

    read_memory.assert_not_called()
    gauge.assert_not_called()


def test_reporter_rechecks_option_while_disabled(
    clock: mock.Mock, read_memory: mock.Mock, gauge: mock.Mock
) -> None:
    reporter = ProcessMemoryReporter("flusher", [0])

    with mock.patch(
        "sentry.spans.consumers.process.memory.options.get", side_effect=[0, 5]
    ) as options_get:
        reporter.maybe_report()
        clock.return_value = 1009.9
        reporter.maybe_report()
        assert options_get.call_count == 1

        clock.return_value = 1010.0
        reporter.maybe_report()
        assert options_get.call_count == 2

    assert read_memory.call_count == 1
    assert gauge.call_count == len(MEMORY)
