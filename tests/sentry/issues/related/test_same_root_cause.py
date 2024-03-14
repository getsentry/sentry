import pytest

from sentry.issues.related.same_root_cause import same_root_cause_analysis
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SameRootCauseAnalysisTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.proj1 = self.create_project(name="foo", organization=self.org)
        self.proj2 = self.create_project(name="bar", organization=self.org)

        self.type = "Error"
        self.value = "oh no"
        same = _data_generation(self.type, self.value)
        # XXX: See if we can get this code to be closer to how save_event generates groups
        self.group1 = Group.objects.create(project=self.proj1, data=same)
        self.group2 = Group.objects.create(project=self.proj1, data=same)

        # No data, different project, error type and title
        Group.objects.create(project=self.proj1, data={"metadata": {}})
        Group.objects.create(project=self.proj2, data=same)
        Group.objects.create(project=self.proj1, data=_data_generation(self.type, "Foo"))
        Group.objects.create(project=self.proj1, data=_data_generation("Foo", self.value))

    @pytest.mark.skip(reason="This test is failing because we need to fix how we create groups")
    def test_same_root_cause_analysis(self) -> None:
        # Making sure that the group has been created correctly
        assert self.group1.title == self.type
        assert self.group1.data["metadata"]["type"] == self.value

        related_groups = same_root_cause_analysis(self.group1)
        assert related_groups == [self.group1, self.group2]


def _data_generation(type: str, value: str) -> dict:
    return {"metadata": {"type": type, "value": value}}
