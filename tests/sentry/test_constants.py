from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.constants import (
    get_integration_id_for_marketing_slug,
    get_integration_id_for_event,
    INTEGRATION_ID_TO_PLATFORM_DATA,
)


mock_integration_ids = {
    "java": {},
    "java-log4j": {},
    "java-log4j2": {},
    "java-android": {},
    "javascript": {},
}


def test_marketing_slug_to_integration_id():
    with patch.dict(INTEGRATION_ID_TO_PLATFORM_DATA, mock_integration_ids):
        assert get_integration_id_for_marketing_slug("java") == "java"
        # kotlin uses the java library, too
        assert get_integration_id_for_marketing_slug("kotlin") == "java"
        assert get_integration_id_for_marketing_slug("android") == "java-android"
        assert get_integration_id_for_marketing_slug("foobar") is None


def test_integration_id_for_event():
    with patch.dict(INTEGRATION_ID_TO_PLATFORM_DATA, mock_integration_ids):
        assert get_integration_id_for_event("java", "sentry-java", None) == "java"
        assert get_integration_id_for_event("java", "raven-java", None) == "java"
        assert get_integration_id_for_event("java", "raven-java:log4j", None) == "java-log4j"
        assert get_integration_id_for_event("java", "sentry-java", ["android"]) == "java-android"
        assert (
            get_integration_id_for_event("java", "sentry-java", ["foobar", "log4j2"])
            == "java-log4j2"
        )
        assert get_integration_id_for_event("foobar", "sentry-java", None) == "java"
        assert get_integration_id_for_event("java", "foobar", None) == "java"
        assert get_integration_id_for_event("foobar", "foobar", None) is None
