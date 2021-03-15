from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome

CATEGORY_NAME_MAP = {
    DataCategory.ERROR: "statsErrors",
    DataCategory.TRANSACTION: "statsTransactions",
    DataCategory.ATTACHMENT: "statsAttachments",
}


class StatsResponse:
    def __init__(self):
        self._values = {k: TimeSeriesUsageStats() for k in CATEGORY_NAME_MAP}

    def get(self, category):
        return self._values[category]

    def __iter__(self):
        return iter(self._values.items())

    def build_fields(self):
        return {CATEGORY_NAME_MAP[category]: values.serialize() for category, values in self}


# # TODO: perhaps remove this class
class TimeSeriesUsageStats:
    def __init__(self):
        self.values = {}

    def update(self, row):
        if row["time"] in self.values:
            self.values[row["time"]].update(row)
        else:
            self.values[row["time"]] = UsageStat(row["time"])
            self.values[row["time"]].update(row)

    def serialize(self):
        return [value.serialize() for value in self.values.values()]


class StatValue:
    def __init__(self, quantity=0, times_seen=0):
        self.quantity = quantity

    def serialize(self):
        return {"quantity": self.quantity}


class UsageStat:
    def __init__(self, time):
        self.accepted = StatValue()
        self.filtered = StatValue()
        self.over_quota = StatValue()
        self.spike_protection = StatValue()
        self.other = StatValue()
        self.time = time

    def serialize(self):
        return {
            "accepted": self.accepted.serialize(),
            "filtered": self.filtered.serialize(),
            "dropped": {
                "overQuota": self.over_quota.serialize(),
                "spikeProtection": self.spike_protection.serialize(),
                "other": self.other.serialize(),
            },
            "time": self.time,
        }

    def update(self, row):
        def find_measure():
            if "outcome" not in row:
                return None  # if its a zerofill row
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
