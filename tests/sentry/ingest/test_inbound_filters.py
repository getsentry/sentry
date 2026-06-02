from django.test import override_settings

from sentry.ingest.inbound_filters import _custom_error_filter


def test_custom_error_filter_empty() -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        condition = _custom_error_filter()

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [],
        },
    }


def test_custom_error_filter_uses_settings() -> None:
    with override_settings(
        SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[
            ("MyError", "Something went wrong *"),
            (None, "*known flaky test*"),
        ]
    ):
        condition = _custom_error_filter()

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [
                {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "ty", "value": ["MyError"]},
                        {
                            "op": "glob",
                            "name": "value",
                            "value": ["Something went wrong *"],
                        },
                    ],
                },
                {"op": "glob", "name": "value", "value": ["*known flaky test*"]},
            ],
        },
    }
