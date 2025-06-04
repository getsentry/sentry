from unittest import mock

from sentry.constants import (
    INTEGRATION_ID_TO_PLATFORM_DATA,
    get_integration_id_for_event,
    get_integration_id_for_marketing_slug,
)


def mock_integration_ids():
    return mock.patch.dict(
        INTEGRATION_ID_TO_PLATFORM_DATA,
        {
            "java": {},
            "java-log4j": {},
            "java-log4j2": {},
            "java-android": {},
            "javascript": {},
        },
    )


def test_marketing_slug_to_integration_id():
    with mock_integration_ids():
        assert get_integration_id_for_marketing_slug("java") == "java"
        # kotlin uses the java library, too
        assert get_integration_id_for_marketing_slug("kotlin") == "java"
        assert get_integration_id_for_marketing_slug("android") == "java-android"
        assert get_integration_id_for_marketing_slug("foobar") is None


def test_integration_id_for_event():
    with mock_integration_ids():
        assert get_integration_id_for_event("java", "sentry-java", []) == "java"
        assert get_integration_id_for_event("java", "raven-java", []) == "java"
        assert get_integration_id_for_event("java", "raven-java:log4j", []) == "java-log4j"
        assert get_integration_id_for_event("java", "sentry-java", ["android"]) == "java-android"
        assert (
            get_integration_id_for_event("java", "sentry-java", ["foobar", "log4j2"])
            == "java-log4j2"
        )
        assert get_integration_id_for_event("foobar", "sentry-java", []) == "java"
        assert get_integration_id_for_event("java", "foobar", []) == "java"
        assert get_integration_id_for_event("foobar", "foobar", []) is None
