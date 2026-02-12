import enum


class FixabilityScoreThresholds(enum.Enum):
    SUPER_HIGH = 0.76
    HIGH = 0.66
    MEDIUM = 0.40
    LOW = 0.25
    SUPER_LOW = 0.0

    def to_str(self) -> str:
        """
        Return the string representation of the fixability score threshold.
        """
        return self.name.lower()

    @classmethod
    def from_str(self, name: str) -> "FixabilityScoreThresholds | None":
        """
        Return the fixability score threshold from a string representation.
        """
        name = name.upper()
        return self[name] if name in self.__members__ else None


class AutofixAutomationTuningSettings(enum.StrEnum):
    OFF = "off"
    SUPER_LOW = "super_low"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ALWAYS = "always"


class AutofixStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    PROCESSING = "PROCESSING"
    NEED_MORE_INFORMATION = "NEED_MORE_INFORMATION"
    CANCELLED = "CANCELLED"
    WAITING_FOR_USER_RESPONSE = "WAITING_FOR_USER_RESPONSE"


class AutofixReferrer(enum.StrEnum):
    GROUP_AUTOFIX_ENDPOINT = "api.group_ai_autofix"
    ISSUE_SUMMARY_FIXABILITY = "issue_summary.fixability"
    ISSUE_SUMMARY_ALERT_FIXABILITY = "issue_summary.alert_fixability"
    ISSUE_SUMMARY_POST_PROCESS_FIXABILITY = "issue_summary.post_process_fixability"
    SLACK = "slack"
    UNKNOWN = "unknown"


class SeerAutomationSource(enum.Enum):
    ISSUE_DETAILS = "issue_details"
    ALERT = "alert"
    POST_PROCESS = "post_process"
