from typing import TypedDict


class KeyTransactionTeamResponse(TypedDict):
    team: str


class KeyedTransaction(TypedDict):
    project_id: str
    transaction: str


class TeamKeyTransactionsResponse(TypedDict):
    team: str
    count: int
    keyed: list[KeyedTransaction]
