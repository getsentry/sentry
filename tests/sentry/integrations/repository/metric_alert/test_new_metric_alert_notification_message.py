import pytest

from sentry.integrations.repository.metric_alert import (
    IncidentAndTriggerActionValidationError,
    MessageIdentifierWithErrorValidationError,
    NewMetricAlertNotificationMessage,
)


class TestGetValidationError:
    @classmethod
    def _raises_error_for_obj(
        cls, obj: NewMetricAlertNotificationMessage, expected_error: type[Exception]
    ) -> None:
        error = obj.get_validation_error()
        assert error is not None
        with pytest.raises(expected_error):
            raise error

    def test_returns_error_when_message_identifier_has_error_code(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            message_identifier="abc",
            error_code=400,
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_returns_error_when_message_identifier_has_error_details(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            message_identifier="abc",
            error_details={"some_key": 123},
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_returns_error_when_message_identifier_has_error(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            message_identifier="abc",
            error_code=400,
            error_details={"some_key": 123},
        )
        self._raises_error_for_obj(obj, MessageIdentifierWithErrorValidationError)

    def test_returns_error_when_message_identifier_does_not_have_incident(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            message_identifier="abc",
            trigger_action_id=123,
        )
        self._raises_error_for_obj(obj, IncidentAndTriggerActionValidationError)

    def test_returns_error_when_message_identifier_does_not_have_trigger_action(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            message_identifier="abc",
            incident_id=123,
        )
        self._raises_error_for_obj(obj, IncidentAndTriggerActionValidationError)

    def test_returns_error_when_trigger_action_is_missing(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            incident_id=123,
        )
        self._raises_error_for_obj(obj, IncidentAndTriggerActionValidationError)

    def test_returns_error_when_incident_is_missing(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            trigger_action_id=123,
        )
        self._raises_error_for_obj(obj, IncidentAndTriggerActionValidationError)

    def test_simple(self) -> None:
        obj = NewMetricAlertNotificationMessage(
            incident_id=123,
            trigger_action_id=123,
        )
        error = obj.get_validation_error()
        assert error is None
