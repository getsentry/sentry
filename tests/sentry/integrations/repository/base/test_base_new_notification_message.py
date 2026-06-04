import pytest

from sentry.integrations.repository.base import (
    BaseNewNotificationMessage,
    MessageIdentifierWithErrorValidationError,
)


class TestGetValidationError:
    @classmethod
    def _raises_error_for_obj(
        cls, obj: BaseNewNotificationMessage, expected_error: type[Exception]
    ) -> None:
        error = obj.get_validation_error()
        assert error is not None
        with pytest.raises(expected_error):
            raise error

    def test_returns_error_when_message_identifier_has_error_code(self) -> None:
        obj = BaseNewNotificationMessage(
            message_identifier="abc",
            error_code=400,
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_returns_error_when_message_identifier_has_error_details(self) -> None:
        obj = BaseNewNotificationMessage(
            message_identifier="abc",
            error_details={"some_key": 123},
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_returns_error_when_message_identifier_has_error(self) -> None:
        obj = BaseNewNotificationMessage(
            message_identifier="abc",
            error_code=400,
            error_details={"some_key": 123},
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_simple(self) -> None:
        obj = BaseNewNotificationMessage()
        error = obj.get_validation_error()
        assert error is None
