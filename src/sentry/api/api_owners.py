from enum import Enum


class ApiOwner(Enum):
    """
    Used to track ownership of APIs
    Value should map to team's github group
    """

    DISCOVER_N_DASHBOARDS = "discover-n-dashboards"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    ENTERPRISE = "enterprise"
    SECURITY = "security"
    HYBRID_CLOUD = "hybrid-cloud"
    ISSUES = "issues"
    PERFORMANCE = "performance"
    TEAM_STARFISH = "team-starfish"
    PROFILING = "profiling"
    GROWTH = "growth"
    OWNERS_INGEST = "owners-ingest"
    OWNERS_NATIVE = "owners-native"
    REPLAY = "replay-backend"
    WEB_FRONTEND_SDKS = "team-web-sdk-frontend"
    FEEDBACK = "feedback-backend"
    CRONS = "crons"
    UNOWNED = "unowned"
