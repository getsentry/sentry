from django.urls import reverse
from django.utils import timezone

from sentry.models.groupsearchviewlastseen import GroupSearchViewLastSeen
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from tests.sentry.issues.endpoints.test_organization_group_search_views import BaseGSVTestCase


class OrganizationGroupSearchViewVisitTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-visit"
    method = "post"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        # Get the first view's ID for testing
        self.view_id = str(self.base_data["user_one_views"][0].id)

        self.url = reverse(
            "sentry-api-0-organization-group-search-view-visit",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": self.view_id},
        )

    @freeze_time("2025-03-03 14:52:37")
    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_update_last_seen_success(self) -> None:
        assert (
            GroupSearchViewLastSeen.objects.filter(
                organization=self.organization,
                user_id=self.user.id,
                group_search_view_id=self.view_id,
            ).count()
            == 0
        )

        response = self.client.post(self.url)
        assert response.status_code == 204

        # Verify the last_seen record was created
        last_seen = GroupSearchViewLastSeen.objects.get(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=self.view_id,
        )
        assert last_seen.last_seen == timezone.now()

    @freeze_time("2025-03-03 14:52:37")
    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_update_existing_last_seen(self) -> None:
        # Create an initial last_seen record with an old timestamp
        with freeze_time("2025-02-03 14:52:37"):
            GroupSearchViewLastSeen.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                group_search_view_id=self.view_id,
                last_seen=timezone.now(),
            )

        # Update the last_seen timestamp
        response = self.client.post(self.url)
        assert response.status_code == 204

        # Verify the last_seen record was updated
        last_seen = GroupSearchViewLastSeen.objects.get(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=self.view_id,
        )
        assert last_seen.last_seen == timezone.now()
        assert last_seen.last_seen.year == 2025  # Verify it's the new timestamp
        assert last_seen.last_seen.month == 3
        assert last_seen.last_seen.day == 3
        assert last_seen.last_seen.hour == 14
        assert last_seen.last_seen.minute == 52
        assert last_seen.last_seen.second == 37

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_update_nonexistent_view(self) -> None:
        nonexistent_id = "99999"
        url = reverse(
            "sentry-api-0-organization-group-search-view-visit",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": nonexistent_id},
        )

        response = self.client.post(url)
        assert response.status_code == 404

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_update_view_from_another_user(self) -> None:
        # Get a view ID from user_two
        view_id = str(self.base_data["user_two_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-visit",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        # This should succeed because the view exists in the organization
        # and the endpoint only checks if the view exists in the organization
        response = self.client.post(url)
        assert response.status_code == 204

        # Verify the last_seen record was created for the current user
        last_seen = GroupSearchViewLastSeen.objects.get(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=view_id,
        )
        assert last_seen is not None

    def test_update_without_feature_flag(self) -> None:
        response = self.client.post(self.url)
        assert response.status_code == 404

        # Verify no last_seen record was created
        assert not GroupSearchViewLastSeen.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=self.view_id,
        ).exists()
