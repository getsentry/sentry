from sentry.models.groupsearchview import GroupSearchView
from sentry.testutils.cases import TestCase


class GroupSearchViewTestCase(TestCase):
    def test_create_views(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization()

        GroupSearchView.objects.create(
            name="View 1",
            user_id=user.id,
            organization=org,
            query="some query",
            query_sort="date",
            position=0,
        )

        GroupSearchView.objects.create(
            name="View 2",
            user_id=user.id,
            organization=org,
            query="some query #2",
            query_sort="date",
            position=1,
        )

        assert GroupSearchView.objects.filter(user_id=user.id).count() == 2
        assert GroupSearchView.objects.filter(user_id=user.id, position=0).count() == 1
        assert GroupSearchView.objects.filter(user_id=user.id, position=1).count() == 1
