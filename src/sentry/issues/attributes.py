from typing import Optional

from sentry.utils import metrics


def _log_create_or_update(
    created: bool, model_inducing_snapshot: str, column_inducing_snapshot: Optional[str] = None
) -> None:
    metrics.incr(
        "group_attributes.create_or_update",
        tags={
            "operation": "create" if created else "update",
            "model": model_inducing_snapshot,
            "column": column_inducing_snapshot,
        },
    )
