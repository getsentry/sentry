from django.urls import reverse

from sentry.models import GroupSubscription
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class GroupParticipantsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _get_path_functions(self):
        return (
            lambda group: reverse("sentry-api-0-group-stats", args=[group.id]),
            lambda group: reverse(
                "sentry-api-0-group-stats-with-org", args=[self.organization.slug, group.id]
            ),
        )

    def test_simple(self):
        group = self.create_group()
        GroupSubscription.objects.create(
            user=self.user, group=group, project=group.project, is_active=True
        )

        for path_func in self._get_path_functions():
            path = path_func(group)

            response = self.client.get(path)

            assert len(response.data) == 1
            assert response.data[0]["id"] == str(self.user.id)
