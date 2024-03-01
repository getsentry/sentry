from enum import Enum


class ApiOwner(Enum):
    """
    Used to track ownership of APIs
    Value should map to team's github group
    """

    BILLING = "revenue"
    CRONS = "crons"
    DISCOVER_N_DASHBOARDS = "discover-n-dashboards"
    ECOSYSTEM = "ecosystem"
    ENTERPRISE = "enterprise"
    FEEDBACK = "feedback-backend"
    HYBRID_CLOUD = "hybrid-cloud"
    INTEGRATIONS = "product-owners-settings-integrations"
    ISSUES = "issues"
    ML_AI = "machine-learning-ai"
    OPEN_SOURCE = "open-source"
    OWNERS_INGEST = "ingest"
    OWNERS_NATIVE = "owners-native"
    OWNERS_SNUBA = "owners-snuba"
    PERFORMANCE = "performance"
    PROCESSING = "processing"
    PROFILING = "profiling"
    REPLAY = "replay-backend"
    SECURITY = "security"
    TEAM_STARFISH = "team-starfish"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    UNOWNED = "unowned"
    WEB_FRONTEND_SDKS = "team-web-sdk-frontend"
