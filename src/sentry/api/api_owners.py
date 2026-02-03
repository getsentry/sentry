from enum import Enum


class ApiOwner(Enum):
    """
    Used to track ownership of APIs
    Value should map to team's github group
    """

    ALERTS_NOTIFICATIONS = "alerts-notifications"
    BILLING = "revenue"
    CODECOV = "codecov"
    CODING_WORKFLOWS = "coding-workflows"
    CRONS = "crons"
    DASHBOARDS = "dashboards"
    DATA_BROWSING = "data-browsing"
    ECOSYSTEM = "ecosystem"
    EMERGE_TOOLS = "emerge-tools"
    ENTERPRISE = "enterprise"
    EXPLORE = "explore"
    FEEDBACK = "feedback-backend"
    FLAG = "replay-backend"
    FOUNDATIONAL_STORAGE = "foundational-storage"
    GDX = "gdx"
    HYBRID_CLOUD = "hybrid-cloud"
    INFRA_ENG = "sre-infrastructure-engineering"
    INTEGRATIONS = "product-owners-settings-integrations"
    ISSUE_DETECTION_BACKEND = "issue-detection-backend"
    ISSUES = "issue-workflow"
    ML_AI = "machine-learning-ai"
    OWNERS_INGEST = "ingest"
    OWNERS_SNUBA = "owners-snuba"
    PROFILING = "profiling"
    REPLAY = "replay-backend"
    SECURITY = "security"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    UNOWNED = "unowned"
    WEB_FRONTEND_SDKS = "team-javascript-sdks"
