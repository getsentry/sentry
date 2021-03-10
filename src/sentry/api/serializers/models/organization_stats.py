from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome

from sentry.utils.snuba import (
    naiveify_datetime,
    to_naive_timestamp,
)

CATEGORY_NAME_MAP = {
    DataCategory.ERROR: "statsErrors",
    DataCategory.TRANSACTION: "statsTransactions",
    DataCategory.ATTACHMENT: "statsAttachments",
}


class StatsResponse:
    def __init__(self, start, end, rollup):
        self._values = {k: TimeSeriesValues(start, end, rollup) for k in CATEGORY_NAME_MAP}

    def get(self, category):
        return self._values[category]

    def __iter__(self):
        return iter(self._values.items())

    def zerofill(self, start, end, rollup):
        self.errors = zerofill(self.errors, start, end, rollup, "time")
        self.transactions = zerofill(self.transactions, start, end, rollup, "time")
        self.attachments = zerofill(self.attachments, start, end, rollup, "time")

    def build_fields(self):
        return {CATEGORY_NAME_MAP[category]: values.serialize() for category, values in self}


# # TODO: perhaps remove this class
class TimeSeriesValues:
    def __init__(self, start, end, rollup):
        self.values = zerofill({}, start, end, rollup, "time")

    def update(self, row):
        self.values[row["time"]].update(row)

    def serialize(self):
        return [value.serialize() for value in self.values.values()]


class StatValue:
    def __init__(self, quantity=0, times_seen=0):
        self.quantity = quantity
        self.times_seen = times_seen

    def serialize(self):
        pass


class UsageStatCategory:
    def __init__(self, time):
        self.accepted = StatValue()
        self.filtered = StatValue()
        self.over_quota = StatValue()
        self.spike_protection = StatValue()
        self.other = StatValue()
        self.time = time

    def serialize(self):
        return {
            "accepted": {
                "quantity": self.accepted.quantity,
                "times_seen": self.accepted.times_seen,
            },
            "filtered": {"quantity": self.filtered.quantity, "times_seen": self.filtered.quantity},
            "dropped": {
                "overQuota": {
                    "quantity": self.over_quota.quantity,
                    "times_seen": self.over_quota.quantity,
                },
                "spikeProtection": {
                    "quantity": self.spike_protection.quantity,
                    "times_seen": self.spike_protection.quantity,
                },
                "other": {"quantity": self.other.quantity, "times_seen": self.other.quantity},
            },
            "time": self.time,
        }

    def update(self, row):
        def find_measure():
            if row["outcome"] == Outcome.RATE_LIMITED:
                if row["reason"] in {"usage_exceeded", "grace_period"}:
                    return self.over_quota
                elif row["reason"] == "smart_rate_limit":
                    return self.spike_protection, False
                else:
                    return self.other
            elif row["outcome"] == Outcome.ACCEPTED:
                return self.accepted
            elif row["outcome"] == Outcome.FILTERED:
                return self.filtered
            else:
                return None  # or raise an error?

        measure_to_update = find_measure()
        if measure_to_update:
            measure_to_update.quantity = row["quantity"]
            measure_to_update.times_seen = row["times_seen"]


# TODO: verify what kind of timestamp we return to frontend
def zerofill(data, start, end, rollup, orderby):
    rv = {}
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]
    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            val = UsageStatCategory(key)
            rv[key] = val

    return rv
