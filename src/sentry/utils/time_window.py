from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class TimeWindow:
    # Timestamps are in seconds
    start: float
    end: float

    def as_tuple(self) -> tuple[float, float]:
        return (self.start, self.end)

    @property
    def duration_ms(self) -> float:
        return (self.end - self.start) * 1000

    def __add__(self, other: "TimeWindow") -> tuple[Optional["TimeWindow"], "TimeWindow"]:
        if self.start < other.start:
            if self.end < other.start:
                return self, other
            return None, TimeWindow(start=self.start, end=max(self.end, other.end))
        else:
            if self.start > other.end:
                return other, self
            return None, TimeWindow(start=other.start, end=max(self.end, other.end))

    def __sub__(self, other: "TimeWindow") -> tuple[Optional["TimeWindow"], "TimeWindow"]:
        if self.start < other.start:
            if self.end > other.end:
                return (
                    TimeWindow(start=self.start, end=other.start),
                    TimeWindow(start=other.end, end=self.end),
                )
            return None, TimeWindow(start=self.start, end=min(self.end, other.start))
        else:
            if self.end < other.end:
                return None, TimeWindow(start=self.end, end=self.end)
            return None, TimeWindow(start=max(self.start, other.end), end=self.end)


def union_time_windows(time_windows: list[TimeWindow]) -> list[TimeWindow]:
    if not time_windows:
        return []

    previous, *time_windows = sorted(time_windows, key=lambda window: window.as_tuple())

    unioned: list[TimeWindow] = []

    for current in time_windows:
        window, previous = previous + current
        if window:
            unioned.append(window)

    unioned.append(previous)

    return unioned


def remove_time_windows(source: TimeWindow, time_windows: list[TimeWindow]) -> list[TimeWindow]:
    if not time_windows:
        return [source]

    removed: list[TimeWindow] = []

    for current in time_windows:
        window, source = source - current
        if window:
            removed.append(window)

    removed.append(source)

    # After subtracting time windows, we may end up with 0 width time_windows.
    # remove them from the results.
    return [time_window for time_window in removed if time_window.start != time_window.end]
