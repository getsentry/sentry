from drf_spectacular.utils import OpenApiExample

from sentry.discover.endpoints.discover_key_transactions_types import (
    KeyTransactionTeamResponse,
    TeamKeyTransactionsResponse,
)

KEY_TRANSACTION_TEAMS: list[KeyTransactionTeamResponse] = [
    {"team": "4502938"},
    {"team": "4502941"},
]

TEAM_KEY_TRANSACTIONS: list[TeamKeyTransactionsResponse] = [
    {
        "team": "4502938",
        "count": 2,
        "keyed": [
            {"project_id": "4505281256090153", "transaction": "/api/checkout/"},
            {"project_id": "4505281256090153", "transaction": "/api/orders/{order_id}/"},
        ],
    },
    {
        "team": "4502941",
        "count": 0,
        "keyed": [],
    },
]


class KeyTransactionExamples:
    LIST_KEY_TRANSACTION_TEAMS = [
        OpenApiExample(
            "List the teams that have a transaction marked as key",
            value=KEY_TRANSACTION_TEAMS,
            status_codes=["200"],
            response_only=True,
        )
    ]

    LIST_TEAM_KEY_TRANSACTIONS = [
        OpenApiExample(
            "List key transactions by team",
            value=TEAM_KEY_TRANSACTIONS,
            status_codes=["200"],
            response_only=True,
        )
    ]
