import concurrent.futures
import logging
from typing import Any

import sentry_sdk

from sentry import features, options
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import get_issue_summary
from sentry.seer.autofix.utils import is_seer_scanner_rate_limited
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
    project = group.project
    if not project.get_option("sentry:seer_scanner_automation"):
        return None
    if group.organization.get_option("sentry:hide_ai_features"):
        return None
    if not group.organization.get_option("sentry:enable_seer_enhanced_alerts", default=True):
        return None
    if not get_seer_org_acknowledgement(group.organization):
        return None

    from sentry import quotas
    from sentry.constants import DataCategory

    has_budget: bool = quotas.backend.check_seer_quota(
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
                    get_issue_summary, group, source=SeerAutomationSource.ALERT
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
