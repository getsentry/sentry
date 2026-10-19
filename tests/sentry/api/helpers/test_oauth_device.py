from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.api.helpers.oauth_device import (
    DeviceRequestErrorCode,
    InvalidDeviceRequest,
    complete_device_request,
    get_device_request,
    get_prepared_device_request,
    prepare_device_consent,
)
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class DeviceRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application()
        self.device = self.create_api_device_code(application=self.application)

    def test_normalization_and_session_binding(self) -> None:
        code = self.device.user_code.replace("-", "").lower()
        device = get_device_request(f" {code} ", "127.0.0.1")
        assert device.id == self.device.id
        session = self.client.session
        prepare_device_consent(session, device, self.user.id)
        assert get_prepared_device_request(session, code, self.user.id).id == device.id
        with pytest.raises(InvalidDeviceRequest) as error:
            get_prepared_device_request(session, code, self.create_user().id)
        assert error.value.code == DeviceRequestErrorCode.INVALID_SESSION

    def test_expired_code(self) -> None:
        self.device.update(expires_at=timezone.now() - timedelta(seconds=1))
        with pytest.raises(InvalidDeviceRequest) as error:
            get_device_request(self.device.user_code, "127.0.0.1")
        assert error.value.code == DeviceRequestErrorCode.EXPIRED

    def test_inactive_application(self) -> None:
        self.application.update(status=ApiApplicationStatus.inactive)
        with pytest.raises(InvalidDeviceRequest) as error:
            get_device_request(self.device.user_code, "127.0.0.1")
        assert error.value.code == DeviceRequestErrorCode.INVALID_CODE

    def test_throttles_before_code_lookup(self) -> None:
        with patch("sentry.api.helpers.oauth_device.ratelimiter.is_limited", return_value=True):
            with pytest.raises(InvalidDeviceRequest) as error:
                get_device_request(self.device.user_code, "127.0.0.1")
        assert error.value.code == DeviceRequestErrorCode.RATE_LIMITED

    def test_parallel_sessions(self) -> None:
        other = self.create_api_device_code(application=self.application)
        session = self.client.session
        prepare_device_consent(session, self.device, self.user.id)
        prepare_device_consent(session, other, self.user.id)
        assert (
            get_prepared_device_request(session, self.device.user_code, self.user.id).id
            == self.device.id
        )
        assert get_prepared_device_request(session, other.user_code, self.user.id).id == other.id

    def test_decision_is_terminal(self) -> None:
        assert complete_device_request(self.device.id, self.user.id, "deny") == "denied"
        with pytest.raises(InvalidDeviceRequest):
            complete_device_request(self.device.id, self.user.id, "approve")
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.DENIED

    def test_authorization_failure_rolls_back_decision(self) -> None:
        with patch(
            "sentry.api.helpers.oauth_device.persist_authorization", side_effect=RuntimeError
        ):
            with pytest.raises(RuntimeError):
                complete_device_request(self.device.id, self.user.id, "approve")
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.PENDING

    def test_saves_authorization_with_approval(self) -> None:
        self.device.update(scope_list=["project:read"])
        assert complete_device_request(self.device.id, self.user.id, "approve") == "approved"
        self.device.refresh_from_db()
        assert self.device.user_id == self.user.id
        assert ApiAuthorization.objects.get(
            application=self.application, user=self.user
        ).scope_list == ["project:read"]
