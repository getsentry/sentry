import concurrent.futures
import logging
from typing import Any

import sentry_sdk

from sentry import features, options
from sentry.autofix.utils import SeerAutomationSource
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.seer.issue_summary import get_issue_summary
from sentry.seer.seer_setup import get_seer_org_acknowledgement

logger = logging.getLogger(__name__)


def fetch_issue_summary(group: Group) -> dict[str, Any] | None:
    """
    Try to fetch an issue summary with a timeout of 5 seconds.
    Returns the summary data if successful, None otherwise.
    """
    if group.issue_category != GroupCategory.ERROR:
        return None
    if not features.has("organizations:gen-ai-features", group.organization):
        return None
    if not features.has("organizations:trigger-autofix-on-issue-summary", group.organization):
        return None
    if not get_seer_org_acknowledgement(org_id=group.organization.id):
        return None

    timeout = options.get("alerts.issue_summary_timeout") or 5

    try:
        with sentry_sdk.start_span(op="ai_summary.fetch_issue_summary_for_alert"):
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    get_issue_summary, group, source=SeerAutomationSource.ALERT
                )
                summary_result, status_code = future.result(timeout=timeout)

                if status_code == 200:
                    return summary_result
                return None
    except (concurrent.futures.TimeoutError, Exception) as e:
        logger.exception("Error generating issue summary: %s", e)
        return None
