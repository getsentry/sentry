import logging
from functools import partial

from .backends import backend
from .deliver_organization_user_report import deliver_organization_user_report
from .prepare_organization_report import prepare_organization_report
from .prepare_reports import prepare_reports
from .utils.build import build_project_aggregates, build_project_issue_summaries, build_report
from .utils.constants import BATCH_SIZE, ONE_DAY
from .utils.merge import merge_sequences, merge_series
from .utils.notification import build_message
from .utils.search import (
    build_key_errors,
    build_key_transactions,
    build_project_series,
    build_project_usage_outcomes,
)
from .utils.util import safe_add, take_max_n
from .verify_prepare_reports import verify_prepare_reports

__all__ = (
    "deliver_organization_user_report",
    "prepare_organization_report",
    "prepare_reports",
    "verify_prepare_reports",
    "backend",
    "BATCH_SIZE",
    "ONE_DAY",
    "Report",
    "build_message",
    "logger",
)

logger = logging.getLogger(__name__)

Report, build_project_report, merge_reports = build_report(
    [
        (
            "series",
            build_project_series,
            partial(merge_series, function=merge_sequences),
        ),
        (
            "aggregates",
            build_project_aggregates,
            partial(merge_sequences, function=safe_add),
        ),
        ("issue_summaries", build_project_issue_summaries, merge_sequences),
        ("series_outcomes", build_project_usage_outcomes, merge_sequences),
        ("key_events", build_key_errors, partial(take_max_n, n=3)),
        ("key_transactions", build_key_transactions, partial(take_max_n, n=3)),
    ],
)
