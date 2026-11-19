"""
Memory gauges for each process of the process-spans consumer.

When a consumer starts into a backlog, the pod's memory grows with the backlog
and stays high until the pod is replaced. The arroyo main process and the
SpanFlusher child processes each hold part of it, but container metrics only
show the pod total. These gauges report each process on its own:

    spans.buffer.process_memory.rss       VmRSS, resident memory
    spans.buffer.process_memory.rss_anon  RssAnon, anonymous memory (heap)
    spans.buffer.process_memory.rss_file  RssFile, file-backed memory
    spans.buffer.process_memory.peak_rss  VmHWM, highest RSS since start

All values are bytes, tagged with `buffer_component` ("consumer" for the arroyo
main process, "flusher" for a SpanFlusher child) and `shards`, the shards that
the process handles. The tag key is not `component`, because the pods already
send `component:consumer` as a constant tag on every metric, from the main
process and the flushers alike.

The values come from /proc/self/status, so this only works on Linux. On other
platforms, or if the file cannot be read, nothing is reported.
"""

from __future__ import annotations

import sys
from collections.abc import Sequence
from time import monotonic
from typing import Literal

from sentry import options
from sentry.utils import metrics

_STATUS_PATH = "/proc/self/status"
_IS_LINUX = sys.platform.startswith("linux")

# Fields read from /proc/self/status, mapped to the gauge suffix they are
# reported under. The kernel reports them in kB.
_STATUS_FIELDS = {
    b"VmRSS": "rss",
    b"RssAnon": "rss_anon",
    b"RssFile": "rss_file",
    b"VmHWM": "peak_rss",
}

# While the gauges are disabled, how often to check the option again.
_DISABLED_RECHECK_SECONDS = 10.0


def parse_process_status(content: bytes) -> dict[str, int]:
    """
    Parse the contents of /proc/<pid>/status into bytes, keyed by the gauge
    suffixes in `_STATUS_FIELDS`. Missing or malformed fields are left out.
    """
    memory: dict[str, int] = {}
    for line in content.splitlines():
        field, _, value = line.partition(b":")
        name = _STATUS_FIELDS.get(field)
        if name is None:
            continue
        parts = value.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1] == b"kB":
            memory[name] = int(parts[0]) * 1024
    return memory


def read_process_memory() -> dict[str, int]:
    """
    Read the current process's memory from /proc/self/status, in bytes. Returns
    an empty dict when not on Linux or when the file cannot be read.
    """
    if not _IS_LINUX:
        return {}
    try:
        with open(_STATUS_PATH, "rb") as f:
            content = f.read()
    except OSError:
        return {}
    return parse_process_status(content)


class ProcessMemoryReporter:
    """
    Emits the current process's memory gauges at most once every
    `spans.buffer.memory-metrics-interval-seconds`, on the first call to
    `maybe_report` once that time has passed.

    `maybe_report` can be called on every poll: until a report is due, it only
    compares the monotonic clock with a deadline. The option is read only when
    a report is due, or every `_DISABLED_RECHECK_SECONDS` while it is 0.
    """

    def __init__(self, component: Literal["consumer", "flusher"], shards: Sequence[int]) -> None:
        self._tags = {"buffer_component": component, "shards": ",".join(map(str, shards))}
        # Report on the first call.
        self._next_report_at = 0.0

    def maybe_report(self) -> None:
        now = monotonic()
        if now < self._next_report_at:
            return
        self._report(now)

    def _report(self, now: float) -> None:
        interval = options.get("spans.buffer.memory-metrics-interval-seconds")
        if interval <= 0:
            self._next_report_at = now + _DISABLED_RECHECK_SECONDS
            return
        self._next_report_at = now + interval

        for name, value in read_process_memory().items():
            # The gauges are already rate limited, so do not sample them.
            metrics.gauge(
                f"spans.buffer.process_memory.{name}",
                value,
                tags=self._tags,
                sample_rate=1.0,
                unit="byte",
            )
