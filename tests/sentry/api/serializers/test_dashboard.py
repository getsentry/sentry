from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import DashboardDetailsModelSerializer
from sentry.models.dashboard import Dashboard
from sentry.testutils.cases import TestCase


class DashboardDetailsModelSerializerTest(TestCase):
    def test_created_by_with_valid_user(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Test Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )

        result = serialize(dashboard, self.user, serializer=DashboardDetailsModelSerializer())

        assert result["createdBy"] is not None
        assert result["createdBy"]["id"] == str(self.user.id)

    def test_created_by_with_deleted_user(self) -> None:
        """When created_by_id points to a non-existent user, createdBy should be None."""
        dashboard = Dashboard.objects.create(
            title="Test Dashboard",
            created_by_id=999999999,
            organization=self.organization,
        )

        result = serialize(dashboard, self.user, serializer=DashboardDetailsModelSerializer())

        assert result["createdBy"] is None

    def test_created_by_with_no_creator(self) -> None:
        """When created_by_id is None, createdBy should be None."""
        dashboard = Dashboard.objects.create(
            title="Test Dashboard",
            created_by_id=None,
            organization=self.organization,
        )

        result = serialize(dashboard, self.user, serializer=DashboardDetailsModelSerializer())

        assert result["createdBy"] is None

    def test_created_by_not_misaligned_across_dashboards(self) -> None:
        """Ensure missing users don't cause misalignment when serializing multiple dashboards."""
        valid_dashboard = Dashboard.objects.create(
            title="Valid Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        deleted_dashboard = Dashboard.objects.create(
            title="Deleted Dashboard",
            created_by_id=999999999,
            organization=self.organization,
        )

        results = serialize(
            [valid_dashboard, deleted_dashboard],
            self.user,
            serializer=DashboardDetailsModelSerializer(),
        )
        by_id = {r["id"]: r for r in results}

        assert by_id[str(valid_dashboard.id)]["createdBy"]["id"] == str(self.user.id)
        assert by_id[str(deleted_dashboard.id)]["createdBy"] is None
