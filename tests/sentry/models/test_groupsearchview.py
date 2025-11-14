from typing import int
from sentry.models.groupsearchview import GroupSearchView
from sentry.testutils.cases import TestCase


class GroupSearchViewTestCase(TestCase):
    def test_create_views(self) -> None:
        user = self.create_user("foo@example.com")
        org = self.create_organization()

        GroupSearchView.objects.create(
            name="View 1",
            user_id=user.id,
            organization=org,
            query="some query",
            query_sort="date",
        )

        GroupSearchView.objects.create(
            name="View 2",
            user_id=user.id,
            organization=org,
            query="some query #2",
            query_sort="date",
        )

        assert GroupSearchView.objects.filter(user_id=user.id).count() == 2
