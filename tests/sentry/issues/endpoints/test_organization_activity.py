from sentry.models.activity import Activity
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@region_silo_test
class OrganizationActivityTest(APITestCase):
    endpoint = "sentry-api-0-organization-activity"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_empty(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_simple(self):
        group = self.group
        org = group.organization

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )

        response = self.get_success_response(org.slug)
        assert [r["id"] for r in response.data] == [str(activity.id)]

    def test_paginate(self):
        group = self.group
        org = group.organization
        project_2 = self.create_project()
        group_2 = self.store_event(
            data={
                "timestamp": iso_format(before_now(minutes=1)),
                "tags": {"group_id": "group-2"},
            },
            project_id=project_2.id,
        ).group
        assert group_2 is not None

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )
        activity_2 = Activity.objects.create(
            group=group_2,
            project=group_2.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world 2"},
        )
        activity_3 = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world 3"},
        )

        response = self.get_success_response(org.slug, per_page=2)
        assert [r["id"] for r in response.data] == [str(activity_3.id), str(activity_2.id)]
        next_cursor = self.get_cursor_headers(response)[1]

        response = self.get_success_response(org.slug, per_page=2, cursor=next_cursor)
        assert [r["id"] for r in response.data] == [str(activity.id)]
