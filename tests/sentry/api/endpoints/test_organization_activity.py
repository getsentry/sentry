from sentry.models import Activity
from sentry.testutils import APITestCase


class OrganizationActivityTest(APITestCase):
    endpoint = "sentry-api-0-organization-activity"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        group = self.group
        org = group.organization

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=self.user,
            data={"text": "hello world"},
        )

        response = self.get_success_response(org.slug)
        assert [r["id"] for r in response.data] == [str(activity.id)]
