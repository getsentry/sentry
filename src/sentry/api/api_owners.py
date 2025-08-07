from enum import Enum


class ApiOwner(Enum):
    """
    Used to track ownership of APIs
    Value should map to team's github group
    """

    ALERTS_NOTIFICATIONS = "alerts-notifications"
    BILLING = "revenue"
    CODECOV = "codecov"
    CRONS = "crons"
    DASHBOARDS = "dashboards"
    ECOSYSTEM = "ecosystem"
    EMERGE_TOOLS = "emerge-tools"
    ENTERPRISE = "enterprise"
    EXPLORE = "explore"
    FEEDBACK = "feedback-backend"
    FLAG = "replay-backend"
    GDX = "gdx"
    HYBRID_CLOUD = "hybrid-cloud"
    INTEGRATIONS = "product-owners-settings-integrations"
    ISSUES = "issue-workflow"
    ISSUE_DETECTION_BACKEND = "issue-detection-backend"
    ML_AI = "machine-learning-ai"
    OWNERS_INGEST = "ingest"
    OWNERS_SNUBA = "owners-snuba"
    PROFILING = "profiling"
    REPLAY = "replay-backend"
    SECURITY = "security"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    UNOWNED = "unowned"
    VISIBILITY = "visibility"
    WEB_FRONTEND_SDKS = "team-web-sdk-frontend"
