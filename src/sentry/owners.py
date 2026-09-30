from __future__ import annotations

from enum import Enum

import sentry_sdk
from sentry_sdk import Scope

OWNER_ATTRIBUTE = "owner"


class Owner(Enum):
    """
    The engineering team that owns a piece of code: an API endpoint, a task
    namespace, or a consumer. Values map to the team's GitHub group.
    """

    ALERTS_MONITORS = "alerts-monitors"
    BILLING = "revenue"
    CODING_WORKFLOWS = "agent-interfaces-sentry-backend"
    COMMUNITY = "app-backend"
    CRONS = "crons"
    DASHBOARDS = "dashboards"
    DATA_BROWSING = "data-browsing"
    EMERGE_TOOLS = "emerge-tools"
    EXPLORE = "explore"
    FEEDBACK = "feedback-backend"
    FLAG = "replay-backend"
    FOUNDATIONAL_STORAGE = "foundational-storage"
    FOUNDATIONS = "foundations"
    GDX = "gdx"
    HYBRID_CLOUD = "hybrid-cloud"
    INFRA_ENG = "sre-infrastructure-engineering"
    INTEGRATION_PLATFORM = "integration-platform"
    ISSUE_DETECTION_BACKEND = "issue-detection-backend"
    ISSUES = "issues-feed"  # Most of these endpoints are owned but all 3 issues teams but APIOwner doesn't allow multiple owners now
    MESSAGING_INTEGRATIONS = "messaging-integrations"
    ML_AI = "machine-learning-ai"
    NOTIFICATIONS = "notifications"
    OWNERS_INGEST = "ingest"
    OWNERS_SNUBA = "owners-snuba"
    PROFILING = "profiling"
    PROJECT_MANAGEMENT_INTEGRATIONS = "project-management-integrations"
    REPLAY = "replay-backend"
    SCM = "scm"
    SECURITY = "security"
    STREAMING_PLATFORM = "streaming-platform"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    UNOWNED = "unowned"
    VALUE_DISCOVERY = "value-discovery"
    WEB_FRONTEND_SDKS = "team-javascript-sdks"


def set_owner(owner: Owner, scope: Scope | None = None) -> None:
    """
    Mark every span, log, and error captured in `scope` as owned by `owner`.

    The default is the isolation scope, which covers the current request or
    task. Pass the global scope to own a whole process, such as a consumer.
    """
    scope = scope or sentry_sdk.get_isolation_scope()
    scope.set_tag(OWNER_ATTRIBUTE, owner.value)
    scope.set_attribute(OWNER_ATTRIBUTE, owner.value)
