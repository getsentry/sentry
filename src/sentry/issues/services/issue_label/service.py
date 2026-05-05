from sentry.issues.services.issue_label.cache import IssueLabelCache
from sentry.models.issuelabel import IssueLabel


class IssueLabelService:
    """
    Service layer for creating, updating, and deleting IssueLabel records.

    All mutations invalidate the cache so subsequent reads reflect the change.
    """

    def __init__(self) -> None:
        self.cache = IssueLabelCache

    def get_by_group_id(self, group_id: int) -> list[IssueLabel]:
        """Return all IssueLabels for the given issue, using cache."""
        cached = self.cache.get(group_id)
        if cached is not None:
            return cached

        labels = list(IssueLabel.objects.filter(group_id=group_id).select_related("label"))
        self.cache.set(group_id, labels)
        return labels

    def create(self, *, group_id: int, label_id: int, label_value: str) -> IssueLabel:
        """Create a new IssueLabel and invalidate the cache for its issue."""
        issue_label = IssueLabel.objects.create(
            group_id=group_id,
            label_id=label_id,
            label_value=label_value,
        )
        self.cache.invalidate(group_id)
        return issue_label

    def update(
        self,
        *,
        issue_label_id: int,
        label_id: int | None = None,
        label_value: str | None = None,
    ) -> IssueLabel:
        """
        Update an IssueLabel by id.

        Invalidates the cache for the owning issue.
        """
        issue_label = IssueLabel.objects.get(id=issue_label_id)

        update_fields: list[str] = []
        if label_id is not None:
            issue_label.label_id = label_id
            update_fields.append("label_id")
        if label_value is not None:
            issue_label.label_value = label_value
            update_fields.append("label_value")

        if update_fields:
            issue_label.save(update_fields=update_fields)

        self.cache.invalidate(issue_label.group_id)
        return issue_label

    def delete(self, *, issue_label_id: int) -> None:
        """Delete an IssueLabel by id and invalidate the cache for its issue."""
        issue_label = IssueLabel.objects.get(id=issue_label_id)
        group_id = issue_label.group_id
        issue_label.delete()
        self.cache.invalidate(group_id)


issue_label_service = IssueLabelService()
