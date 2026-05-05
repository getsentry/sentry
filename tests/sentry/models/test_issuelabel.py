from sentry.models.issuelabel import IssueLabel
from sentry.models.organizationlabel import OrganizationLabel
from sentry.testutils.cases import TestCase


class IssueLabelTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")

    def test_create(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="high"
        )
        assert issue_label.id is not None
        assert issue_label.group_id == self.group.id
        assert issue_label.label_id == self.label.id
        assert issue_label.label_value == "high"

    def test_select_related_label(self) -> None:
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        issue_label = IssueLabel.objects.filter(group=self.group).select_related("label").first()
        assert issue_label is not None
        assert issue_label.label.label_name == "priority"

    def test_multiple_labels_per_group(self) -> None:
        other_label = OrganizationLabel.objects.create(organization=self.org, label_name="severity")
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        IssueLabel.objects.create(group=self.group, label=other_label, label_value="critical")
        assert IssueLabel.objects.filter(group=self.group).count() == 2

    def test_repr(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="high"
        )
        r = repr(issue_label)
        assert str(self.group.id) in r
        assert str(self.label.id) in r
        assert "high" in r

    def test_delete_cascades_from_group(self) -> None:
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        assert IssueLabel.objects.filter(group=self.group).count() == 1
        self.group.delete()
        assert IssueLabel.objects.filter(group_id=self.group.id).count() == 0
