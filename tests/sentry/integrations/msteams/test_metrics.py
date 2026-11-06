import orjson
import pytest

from sentry.integrations.msteams.metrics import translate_msteams_api_error
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationConfigurationError,
    IntegrationError,
)


def _api_error(code: str) -> ApiError:
    return ApiError(orjson.dumps({"error": {"code": code, "message": "msg"}}).decode(), code=403)


def test_bot_not_in_conversation_roster_is_a_halt() -> None:
    with pytest.raises(IntegrationConfigurationError):
        translate_msteams_api_error(_api_error("BotNotInConversationRoster"))


def test_unknown_error_code_is_a_failure() -> None:
    with pytest.raises(IntegrationError) as excinfo:
        translate_msteams_api_error(_api_error("SomethingUnexpected"))
    assert not isinstance(excinfo.value, IntegrationConfigurationError)
