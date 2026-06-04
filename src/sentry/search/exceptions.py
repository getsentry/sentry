from sentry.exceptions import InvalidSearchQuery


class InvalidIssueSearchQuery(InvalidSearchQuery):
    """Raised when an issue filter references non-existent issue IDs."""

    def __init__(self, invalid_ids: list[str]):
        self.invalid_ids = invalid_ids
        super().__init__(f"Issue IDs do not exist: {invalid_ids}")

    def __str__(self) -> str:
        return f"Issue IDs do not exist: {self.invalid_ids}"
