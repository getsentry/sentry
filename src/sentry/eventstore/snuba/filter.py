from __future__ import absolute_import


class Filter:
    conditions = []
    filter_keys = {}
    start = None
    end = None

    def __init__(self, start=None, end=None, conditions=None, filter_keys=None):
        self.start = start
        self.end = end
        self.conditions = conditions
        self.filter_keys = filter_keys

    def update_start(self, start):
        self.start = start

    def update_end(self, end):
        self.end = end

    def update_conditions(self, conditions):
        self.conditions = conditions

    def update_filter_keys(self, filter_keys):
        self.filter_keys = filter_keys
