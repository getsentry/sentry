from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase


@patch("sentry.issues.endpoints.group_reprocessing.reprocess_group")
class GroupReprocessingTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        # Create an event which will create the group
        event = self.store_event(
            data={
                "message": "hello world",
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        self.group = event.group
        self.url = f"/api/0/issues/{self.group.id}/reprocessing/"

    def test_reprocess_without_admin_scope_and_delete_remaining_events(
        self, mock_reprocess: MagicMock
    ) -> None:
        """Test that users without event:admin scope cannot delete remaining events."""
        # Disable event:admin scope for members
        self.organization.update_option("sentry:events_member_admin", False)

        # Create a member user (not owner/admin)
        member_user = self.create_user()
        self.create_member(
            user=member_user,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(member_user)

        response = self.client.post(
            self.url,
            data={
                "remainingEvents": "delete",
            },
            format="json",
        )

        assert response.status_code == 403
        assert response.data == {"error": "you do not have permission to delete remaining events"}

    def test_reprocess_with_admin_scope_and_delete_remaining_events(
        self, mock_reprocess: MagicMock
    ) -> None:
        """Test that users with event:admin scope can delete remaining events."""
        # Create a user with admin scope
        admin_user = self.create_user()
        self.create_member(
            user=admin_user,
            organization=self.organization,
            role="admin",
            teams=[self.team],
        )
        self.login_as(user=admin_user)

        response = self.client.post(
            self.url,
            data={
                "remainingEvents": "delete",
            },
            format="json",
        )

        # Should succeed (200) because admin has event:admin scope
        assert response.status_code == 200

    def test_reprocess_without_admin_scope_and_keep_remaining_events(
        self, mock_reprocess: MagicMock
    ) -> None:
        """Test that users without event:admin scope can keep remaining events."""
        # Disable event:admin scope for members
        self.organization.update_option("sentry:events_member_admin", False)

        # Create a member user (not owner/admin)
        member_user = self.create_user()
        self.create_member(
            user=member_user,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(member_user)

        response = self.client.post(
            self.url,
            data={
                "remainingEvents": "keep",
            },
            format="json",
        )

        # Should succeed (200) because keeping events doesn't require admin scope
        assert response.status_code == 200

    def test_reprocess_with_max_events_validation(self, mock_reprocess: MagicMock) -> None:
        """Test maxEvents parameter validation."""
        # Test with non-numeric maxEvents
        response = self.client.post(
            self.url,
            data={
                "maxEvents": "abc",
                "remainingEvents": "keep",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"error": "maxEvents must be at least 1"}

        # Test with zero maxEvents
        response = self.client.post(
            self.url,
            data={
                "maxEvents": 0,
                "remainingEvents": "keep",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"error": "maxEvents must be at least 1"}

        # Test with negative maxEvents
        response = self.client.post(
            self.url,
            data={
                "maxEvents": -5,
                "remainingEvents": "keep",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"error": "maxEvents must be at least 1"}

        # Test with valid maxEvents
        response = self.client.post(
            self.url,
            data={
                "maxEvents": 5,
                "remainingEvents": "keep",
            },
            format="json",
        )

        assert response.status_code == 200

    def test_reprocess_with_remaining_events_validation(self, mock_reprocess: MagicMock) -> None:
        """Test remainingEvents parameter validation."""
        # Test with invalid remainingEvents
        response = self.client.post(
            self.url,
            data={
                "remainingEvents": "invalid",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"error": "remainingEvents must be delete or keep"}
