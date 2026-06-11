from sentry.models.groupassignee import GroupAssignee
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


@with_feature("organizations:issue-stream-progress-ui")
class OrganizationGroupIndexProgressTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-index-progress"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self) -> None:
        group = self.create_group(project=self.project)
        response = self.get_success_response(
            self.organization.slug,
            groups=[group.id],
        )
        assert response.data == {"results": {str(group.id): {"progress": "identified"}}}

    def test_triaged_when_assigned(self) -> None:
        group = self.create_group(project=self.project)
        GroupAssignee.objects.assign(group, self.user)

        response = self.get_success_response(
            self.organization.slug,
            groups=[group.id],
        )
        assert response.data == {"results": {str(group.id): {"progress": "triaged"}}}

    def test_diagnosed(self) -> None:
        group = self.create_group(project=self.project)
        self.create_group_activity(group=group, type=ActivityType.SEER_RCA_COMPLETED.value)

        response = self.get_success_response(
            self.organization.slug,
            groups=[group.id],
        )
        assert response.data == {"results": {str(group.id): {"progress": "diagnosed"}}}

    def test_multiple_groups(self) -> None:
        group_a = self.create_group(project=self.project)
        group_b = self.create_group(project=self.project)
        GroupAssignee.objects.assign(group_b, self.user)

        response = self.get_success_response(
            self.organization.slug,
            groups=[group_a.id, group_b.id],
        )
        assert response.data == {
            "results": {
                str(group_a.id): {"progress": "identified"},
                str(group_b.id): {"progress": "triaged"},
            }
        }

    def test_no_groups_param(self) -> None:
        self.get_error_response(
            self.organization.slug,
            status_code=400,
        )

    def test_invalid_group_ids(self) -> None:
        self.get_error_response(
            self.organization.slug,
            groups=["abc"],
            status_code=400,
        )

    def test_no_matching_groups(self) -> None:
        self.get_error_response(
            self.organization.slug,
            groups=[999999999],
            status_code=400,
        )

    def test_feature_flag_disabled(self) -> None:
        group = self.create_group(project=self.project)
        with self.feature({"organizations:issue-stream-progress-ui": False}):
            self.get_error_response(
                self.organization.slug,
                groups=[group.id],
                status_code=404,
            )
