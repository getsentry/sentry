from __future__ import absolute_import

from enum import Enum, unique


@unique
class Dataset(Enum):
    Events = "events"
    Groups = "groups"
    Transactions = "transactions"
    Discover = "discover"
    Outcomes = "outcomes"
    OutcomesRaw = "outcomes_raw"
