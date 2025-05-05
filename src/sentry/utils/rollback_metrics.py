"""
NOTE (vgrozdanic):
Temporary metrics utils for rollback metrics. There is an ongoing
effort to identify the root cause of a few hundred rollbacks per
second in our database, and this should help us identify the root
cause of the issue.

This will be removed after the root cause of the issue is identified.

incr_rollback_metrics method is used to keep track of the number
of times a model is rolled back in a transaction.
"""

from django.db.models import Model

from sentry.utils import metrics


def incr_rollback_metrics(model: type[Model] | None = None, name: str = "unknown") -> None:
    metrics.incr(
        "db.models.transaction_rollback",
        tags={"rollback_source": model.__name__ if model else name},
    )
