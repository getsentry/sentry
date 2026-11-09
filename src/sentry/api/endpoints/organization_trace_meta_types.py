from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription

# The keys are the selected columns of the transaction_children query.
TransactionChildCount = TypedDict(
    "TransactionChildCount",
    {
        "transaction.event_id": Annotated[str, ApiDescription("ID of the transaction")],
        "count()": Annotated[float, ApiDescription("Number of child spans of the transaction")],
    },
)


class OrganizationTraceMetaResponseOptional(TypedDict, total=False):
    uptimeCount: Annotated[
        int,
        ApiDescription(
            "Number of uptime checks in the trace. Only present when `include_uptime=1`"
        ),
    ]


class OrganizationTraceMetaResponse(OrganizationTraceMetaResponseOptional):
    errorsCount: Annotated[int, ApiDescription("Number of errors in the trace")]
    logsCount: Annotated[float, ApiDescription("Number of logs in the trace")]
    metricsCount: Annotated[
        float,
        ApiDescription(
            "Number of metric samples in the trace, excluding metrics derived from spans"
        ),
    ]
    performanceIssuesCount: Annotated[
        int, ApiDescription("Number of performance issues in the trace")
    ]
    spansCount: Annotated[float, ApiDescription("Number of spans in the trace")]
    transactionChildCountMap: Annotated[
        list[TransactionChildCount], ApiDescription("Number of child spans of each transaction")
    ]
    spansCountMap: Annotated[
        dict[str, float],
        ApiDescription("Number of spans in the trace for each span operation, keyed by `span.op`"),
    ]
