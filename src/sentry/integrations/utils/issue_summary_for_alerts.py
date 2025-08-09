import concurrent.futures
import logging
from typing import Any

import sentry_sdk
from django.db import close_old_connections

from sentry import features, options
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import get_issue_summary
from sentry.seer.autofix.utils import is_seer_scanner_rate_limited
from sentry.seer.seer_setup import get_seer_org_acknowledgement

logger = logging.getLogger(__name__)


def _get_issue_summary_with_cleanup(
    group: Group, source: SeerAutomationSource
) -> tuple[dict[str, Any], int]:
    """
    Wrapper for get_issue_summary that ensures database connections are properly closed.
    This is needed when running in a thread to prevent connection leaks.
    """
    try:
        return get_issue_summary(group, source=source)
    finally:
        close_old_connections()


def fetch_issue_summary(group: Group) -> dict[str, Any] | None:
    """
    Try to fetch an issue summary with a timeout of 5 seconds.
    Returns the summary data if successful, None otherwise.
    """
    if group.issue_category != GroupCategory.ERROR:
        return None
    if not features.has("organizations:gen-ai-features", group.organization):
        return None
    project = group.project
    if not project.get_option("sentry:seer_scanner_automation"):
        return None
    if group.organization.get_option("sentry:hide_ai_features"):
        return None
    if not group.organization.get_option("sentry:enable_seer_enhanced_alerts", default=True):
        return None
    if not get_seer_org_acknowledgement(org_id=group.organization.id):
        return None

    from sentry import quotas
    from sentry.constants import DataCategory

    has_budget: bool = quotas.backend.has_available_reserved_budget(
        org_id=group.organization.id, data_category=DataCategory.SEER_SCANNER
    )
    if not has_budget:
        return None

    if is_seer_scanner_rate_limited(project, group.organization):
        return None

    timeout = options.get("alerts.issue_summary_timeout") or 5

    try:
        with sentry_sdk.start_span(op="ai_summary.fetch_issue_summary_for_alert"):
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    _get_issue_summary_with_cleanup, group, SeerAutomationSource.ALERT
                )
                summary_result, status_code = future.result(timeout=timeout)

                if status_code == 200:
                    return summary_result
                return None
    except concurrent.futures.TimeoutError:
        return None
    except Exception as e:
        logger.exception("Error generating issue summary: %s", e)
        return None
