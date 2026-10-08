class NoSeerQuotaException(Exception):
    """Raised when an Autofix run cannot consume Seer quota."""


class IssueSummaryUnavailable(Exception):
    """Raised when an issue summary cannot be generated for an expected reason."""


class IssueSummarySelfHosted(IssueSummaryUnavailable):
    pass


class IssueSummaryHidden(IssueSummaryUnavailable):
    pass


class IssueSummaryEventNotFound(IssueSummaryUnavailable):
    pass
