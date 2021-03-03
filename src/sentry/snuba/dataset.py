from enum import Enum, unique


@unique
class Dataset(Enum):
    Events = "events"
    Transactions = "transactions"
    Discover = "discover"
    Outcomes = "outcomes"
    OutcomesRaw = "outcomes_raw"
    Sessions = "sessions"
