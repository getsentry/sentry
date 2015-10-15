from __future__ import absolute_import


class BackoffStrategy(object):
    def __call__(self, iteration):
        raise NotImplementedError


class IntervalBackoffStrategy(BackoffStrategy):
    def __init__(self, default=60, intervals=None):
        self.default = default
        self.intervals = intervals if intervals is not None else {}

    def __call__(self, iteration):
        return self.intervals.get(iteration, self.default)
