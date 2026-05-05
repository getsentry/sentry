import pytest
from django.db import IntegrityError

from sentry.models.organizationlabel import OrganizationLabel
from sentry.testutils.cases import TestCase


class OrganizationLabelTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()

    def test_create(self) -> None:
        label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        assert label.id is not None
        assert label.organization_id == self.org.id
        assert label.label_name == "priority"

    def test_unique_together_prevents_duplicates(self) -> None:
        OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        with pytest.raises(IntegrityError):
            OrganizationLabel.objects.create(organization=self.org, label_name="priority")

    def test_same_label_name_different_org(self) -> None:
        other_org = self.create_organization()
        label_a = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        label_b = OrganizationLabel.objects.create(organization=other_org, label_name="priority")
        assert label_a.id != label_b.id

    def test_repr(self) -> None:
        label = OrganizationLabel.objects.create(organization=self.org, label_name="severity")
        r = repr(label)
        assert str(self.org.id) in r
        assert "severity" in r
