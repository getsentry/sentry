from __future__ import absolute_import


class Filter:
    conditions = []
    filter_keys = {}
    start = None
    end = None

    def __init__(self, start=None, end=None, conditions=None, filter_keys=None):
        self.start = start
        self.end = end

        if conditions:
            self.conditions = conditions

        if filter_keys:
            self.filter_keys = filter_keys

    def to_snuba_args(self):
        """
        Convert a filter to the legacy snuba_args format
        """
        return {
            'conditions': self.conditions,
            'filter_keys': self.filter_keys,
            'start': self.start,
            'end': self.end,
        }

    def update_start(self, start):
        self.start = start

    def update_end(self, end):
        self.end = end

    def update_conditions(self, conditions):
        self.conditions = conditions

    def update_filter_keys(self, filter_keys):
        self.filter_keys = filter_keys
