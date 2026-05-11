from datetime import datetime, timedelta
from unittest import mock

from django.utils import timezone as django_timezone

from sentry.analytics.events.user_removed import UserRemovedEvent
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.userpermission import UserPermission


@control_silo_test
class UserDetailsSuspendSecurityActivityTest(APITestCase):
    endpoint = "sentry-api-0-user-details"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.target_user = self.create_user(email="target@example.com")
        self.superuser = self.create_user(email="su@example.com", is_superuser=True)
        self.login_as(user=self.superuser, superuser=True)

    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_suspend_emits_security_activity(self, mock_security_activity: mock.MagicMock) -> None:
        self.get_success_response(self.target_user.id, isSuspended="true")

        assert mock_security_activity.called
        kwargs = mock_security_activity.call_args.kwargs
        assert kwargs["type"] == "user.suspended"
        assert kwargs["account"].id == self.target_user.id
        assert kwargs["actor"].id == self.superuser.id
        assert kwargs["send_email"] is False
        assert kwargs["context"] == {"actor_id": self.superuser.id}

    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_unsuspend_emits_security_activity(
        self, mock_security_activity: mock.MagicMock
    ) -> None:
        self.target_user.update(is_suspended=True)

        self.get_success_response(self.target_user.id, isSuspended="false")

        assert mock_security_activity.called
        kwargs = mock_security_activity.call_args.kwargs
        assert kwargs["type"] == "user.unsuspended"
        assert kwargs["account"].id == self.target_user.id
        assert kwargs["send_email"] is False

    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_idempotent_suspend_does_not_emit(self, mock_security_activity: mock.MagicMock) -> None:
        self.target_user.update(is_suspended=True)

        self.get_success_response(self.target_user.id, isSuspended="true")

        assert not mock_security_activity.called

    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_unrelated_update_does_not_emit_suspension_activity(
        self, mock_security_activity: mock.MagicMock
    ) -> None:
        self.get_success_response(self.target_user.id, name="Renamed User")

        assert not mock_security_activity.called


@control_silo_test
class UserDetailsDeleteAnalyticsTest(APITestCase):
    endpoint = "sentry-api-0-user-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="test@example.com")
        self.staff_user = self.create_user(email="staff@example.com", is_staff=True)
        self.login_as(self.staff_user, staff=True)

    @override_options({"staff.ga-rollout": True})
    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_soft_delete_records_analytics_and_security(
        self, mock_security_activity: mock.MagicMock, mock_analytics: mock.MagicMock
    ) -> None:
        before_delete = django_timezone.now()

        self.get_success_response(self.user.id, organizations=[], status_code=204)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

        assert mock_analytics.called
        call_args = mock_analytics.call_args[0][0]
        assert isinstance(call_args, UserRemovedEvent)
        assert call_args.user_id == self.user.id
        assert call_args.actor_id == self.staff_user.id

        assert call_args.deletion_request_datetime is not None
        assert call_args.deletion_datetime is not None
        deletion_request = datetime.fromisoformat(call_args.deletion_request_datetime)
        deletion_scheduled = datetime.fromisoformat(call_args.deletion_datetime)
        assert deletion_request >= before_delete
        assert deletion_scheduled >= deletion_request + timedelta(days=29)
        assert deletion_scheduled <= deletion_request + timedelta(days=31)

        assert mock_security_activity.called
        security_call = mock_security_activity.call_args
        assert security_call[1]["type"] == "user.deactivated"
        assert security_call[1]["account"] == user
        assert security_call[1]["actor"].id == self.staff_user.id
        assert security_call[1]["send_email"] is True
        assert "deactivation_datetime" in security_call[1]["context"]
        assert "scheduled_deletion_datetime" in security_call[1]["context"]

    @override_options({"staff.ga-rollout": True})
    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.users.api.endpoints.user_details.capture_security_activity")
    def test_hard_delete_records_analytics_and_security(
        self, mock_security_activity: mock.MagicMock, mock_analytics: mock.MagicMock
    ) -> None:
        UserPermission.objects.create(user=self.staff_user, permission="users.admin")
        user_id = self.user.id
        user_email = self.user.email
        before_delete = django_timezone.now()

        self.get_success_response(self.user.id, organizations=[], hardDelete=True, status_code=204)

        assert not User.objects.filter(id=user_id).exists()

        assert mock_analytics.called
        call_args = mock_analytics.call_args[0][0]
        assert isinstance(call_args, UserRemovedEvent)
        assert call_args.user_id == user_id
        assert call_args.actor_id == self.staff_user.id

        assert call_args.deletion_request_datetime is not None
        assert call_args.deletion_datetime is not None
        deletion_request = datetime.fromisoformat(call_args.deletion_request_datetime)
        deletion_time = datetime.fromisoformat(call_args.deletion_datetime)
        assert deletion_request >= before_delete
        assert deletion_time == deletion_request

        assert mock_security_activity.called
        security_call = mock_security_activity.call_args
        assert security_call[1]["type"] == "user.removed"
        assert security_call[1]["account"].id == user_id
        assert security_call[1]["account"].email == user_email
        assert security_call[1]["actor"].id == self.staff_user.id
        assert security_call[1]["send_email"] is True
        assert "deletion_datetime" in security_call[1]["context"]
        assert "scheduled_deletion_datetime" not in security_call[1]["context"]

    @override_options({"staff.ga-rollout": True})
    @mock.patch("sentry.analytics.record")
    def test_hard_delete_timestamps_match(self, mock_analytics: mock.MagicMock) -> None:
        UserPermission.objects.create(user=self.staff_user, permission="users.admin")
        self.get_success_response(self.user.id, organizations=[], hardDelete=True, status_code=204)

        call_args = mock_analytics.call_args[0][0]
        assert call_args.deletion_request_datetime == call_args.deletion_datetime

    @override_options({"staff.ga-rollout": True})
    @mock.patch("sentry.analytics.record")
    def test_soft_delete_timestamps_differ_by_30_days(self, mock_analytics: mock.MagicMock) -> None:
        self.get_success_response(self.user.id, organizations=[], status_code=204)

        call_args = mock_analytics.call_args[0][0]
        assert call_args.deletion_request_datetime is not None
        assert call_args.deletion_datetime is not None
        deletion_request = datetime.fromisoformat(call_args.deletion_request_datetime)
        deletion_scheduled = datetime.fromisoformat(call_args.deletion_datetime)

        delta = deletion_scheduled - deletion_request
        assert delta >= timedelta(days=29, hours=23, minutes=59)
        assert delta <= timedelta(days=30, hours=0, minutes=1)
