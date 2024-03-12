from sentry.issues.related.same_root_cause import same_root_cause_analysis
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SameRootCauseAnalysisTest(TestCase):
    # XXX: See if we can get this code to be closer to how save_event generates groups
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.proj1 = self.create_project(name="foo", organization=self.org)
        self.proj2 = self.create_project(name="bar", organization=self.org)

        self.error_type = "Error"
        self.title = "oh no"
        same = _data_generation(self.title, self.error_type)
        self.group1 = Group.objects.create(project=self.proj1, data=same)
        self.group2 = Group.objects.create(project=self.proj1, data=same)

        # No data, different project, error type and title
        Group.objects.create(project=self.proj1, data={"metadata": {}})
        Group.objects.create(project=self.proj2, data=same)
        Group.objects.create(project=self.proj1, data=_data_generation(self.title, "Foo"))
        Group.objects.create(project=self.proj1, data=_data_generation("Foo", self.error_type))

    def test_same_root_cause_analysis(self) -> None:
        # Making sure that the group has been created correctly
        assert self.group1.title == self.title
        assert self.group1.data["metadata"]["type"] == self.error_type

        related_groups = same_root_cause_analysis(self.group1)
        assert related_groups == [self.group1, self.group2]


def _data_generation(title: str, error_type: str) -> dict:
    return {"metadata": {"title": title, "type": error_type}}
