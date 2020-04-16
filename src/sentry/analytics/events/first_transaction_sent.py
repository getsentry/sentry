from __future__ import absolute_import

from sentry import analytics


class FirstTransactionSentEvent(analytics.Event):
    type = "first_transaction.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(FirstTransactionSentEvent)
