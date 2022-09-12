from sentry.models import GroupSubscription
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupParticipantsTest(APITestCase):
    endpoint = "sentry-api-0-group-stats"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        group = self.create_group()
        GroupSubscription.objects.create(
            user=self.user, group=group, project=group.project, is_active=True
        )

        response = self.get_success_response(group.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.user.id)
