from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from sentry.api.fields.actor import ActorField, OwnerActorField
from sentry.testutils.cases import TestCase


class DummySerializer(serializers.Serializer):
    """Test serializer using ActorField."""

    owner = ActorField(required=False, allow_null=True)


class DummyOwnerSerializer(serializers.Serializer):
    """Test serializer using OwnerActorField."""

    owner = OwnerActorField(required=False, allow_null=True)


class ActorFieldTest(TestCase):
    """Tests for the base ActorField."""

    def test_accepts_valid_team(self):
        serializer = DummySerializer(
            data={"owner": f"team:{self.team.id}"},
            context={"organization": self.organization},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"].id == self.team.id
        assert serializer.validated_data["owner"].is_team

    def test_accepts_valid_user(self):
        serializer = DummySerializer(
            data={"owner": f"user:{self.user.id}"},
            context={"organization": self.organization},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"].id == self.user.id
        assert serializer.validated_data["owner"].is_user

    def test_accepts_null(self):
        serializer = DummySerializer(
            data={"owner": None},
            context={"organization": self.organization},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"] is None


class OwnerActorFieldTest(TestCase):
    """
    Tests for OwnerActorField which validates team membership.

    These tests verify that users can only assign teams they belong to as owners,
    unless they have team:admin scope. This prevents IDOR vulnerabilities.
    """

    def setUp(self):
        super().setUp()
        # Create a second team that self.user is NOT a member of
        self.other_team = self.create_team(organization=self.organization, name="other-team")

    def _get_mock_request(self, user, access):
        """Create a mock request object with the given user and access."""

        class MockRequest:
            pass

        request = MockRequest()
        request.user = user
        request.access = access
        return request

    def test_accepts_user_owner_without_restriction(self):
        """User ownership doesn't require membership check."""
        request = self._get_mock_request(self.user, self.create_request().access)
        serializer = DummyOwnerSerializer(
            data={"owner": f"user:{self.user.id}"},
            context={"organization": self.organization, "request": request},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"].id == self.user.id
        assert serializer.validated_data["owner"].is_user

    def test_accepts_null_owner(self):
        """Null owner is always allowed."""
        request = self._get_mock_request(self.user, self.create_request().access)
        serializer = DummyOwnerSerializer(
            data={"owner": None},
            context={"organization": self.organization, "request": request},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"] is None

    def test_member_can_assign_own_team(self):
        """Members can assign teams they belong to."""
        # self.user is a member of self.team via create_member in setUp
        request = self._get_mock_request(self.user, self.create_request().access)
        serializer = DummyOwnerSerializer(
            data={"owner": f"team:{self.team.id}"},
            context={"organization": self.organization, "request": request},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"].id == self.team.id
        assert serializer.validated_data["owner"].is_team

    def test_member_cannot_assign_other_team(self):
        """Members cannot assign teams they don't belong to."""
        request = self._get_mock_request(self.user, self.create_request().access)
        serializer = DummyOwnerSerializer(
            data={"owner": f"team:{self.other_team.id}"},
            context={"organization": self.organization, "request": request},
        )
        assert not serializer.is_valid()
        assert serializer.errors == {
            "owner": [
                ErrorDetail(
                    string="You do not have permission to assign this owner",
                    code="invalid",
                )
            ]
        }

    def test_admin_can_assign_any_team(self):
        """Users with team:admin scope can assign any team."""
        admin_user = self.create_user()
        self.create_member(
            user=admin_user,
            organization=self.organization,
            role="admin",
            teams=[self.team],
        )
        self.login_as(admin_user)
        request = self.make_request(user=admin_user)

        serializer = DummyOwnerSerializer(
            data={"owner": f"team:{self.other_team.id}"},
            context={"organization": self.organization, "request": request},
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["owner"].id == self.other_team.id

    def test_no_request_context_denied(self):
        """Fails closed when no request context is available."""
        serializer = DummyOwnerSerializer(
            data={"owner": f"team:{self.team.id}"},
            context={"organization": self.organization},
        )
        assert not serializer.is_valid()
        assert serializer.errors == {
            "owner": [
                ErrorDetail(
                    string="You do not have permission to assign this owner",
                    code="invalid",
                )
            ]
        }

    def test_no_user_on_request_denied(self):
        """Fails closed when request has no user."""

        class MockRequest:
            user = None
            access = None

        serializer = DummyOwnerSerializer(
            data={"owner": f"team:{self.team.id}"},
            context={"organization": self.organization, "request": MockRequest()},
        )
        assert not serializer.is_valid()
        assert serializer.errors == {
            "owner": [
                ErrorDetail(
                    string="You do not have permission to assign this owner",
                    code="invalid",
                )
            ]
        }
