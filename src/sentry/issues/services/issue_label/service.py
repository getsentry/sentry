from sentry.issues.services.issue_label.cache import IssueLabelCache, OrganizationLabelCache
from sentry.models.issuelabel import IssueLabel
from sentry.models.organizationlabel import OrganizationLabel


class IssueLabelService:
    """
    Service layer for creating, updating, and deleting IssueLabel records.

    All mutations invalidate the cache so subsequent reads reflect the change.
    """

    def __init__(self) -> None:
        self.cache = IssueLabelCache
        self.org_label_cache = OrganizationLabelCache

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

    # -- OrganizationLabel operations --

    def get_org_labels(self, organization_id: int) -> list[OrganizationLabel]:
        """Return all OrganizationLabels for the given organization, using cache."""
        cached = self.org_label_cache.get(organization_id)
        if cached is not None:
            return cached

        labels = list(
            OrganizationLabel.objects.filter(organization_id=organization_id).order_by("label_name")
        )
        self.org_label_cache.set(organization_id, labels)
        return labels

    def create_org_label(self, *, organization_id: int, label_name: str) -> OrganizationLabel:
        """Create a new OrganizationLabel and invalidate the cache for the organization."""
        org_label = OrganizationLabel.objects.create(
            organization_id=organization_id,
            label_name=label_name,
        )
        self.org_label_cache.invalidate(organization_id)
        return org_label

    def update_org_label(self, *, org_label_id: int, label_name: str) -> OrganizationLabel:
        """Update an OrganizationLabel's name and invalidate the cache for its organization."""
        org_label = OrganizationLabel.objects.get(id=org_label_id)
        org_label.label_name = label_name
        org_label.save(update_fields=["label_name"])
        self.org_label_cache.invalidate(org_label.organization_id)
        return org_label

    def delete_org_label(self, *, org_label_id: int) -> None:
        """Delete an OrganizationLabel and invalidate the cache for its organization."""
        org_label = OrganizationLabel.objects.get(id=org_label_id)
        organization_id = org_label.organization_id
        org_label.delete()
        self.org_label_cache.invalidate(organization_id)


issue_label_service = IssueLabelService()
