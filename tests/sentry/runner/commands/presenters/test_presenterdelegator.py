from typing import int
import pytest
import responses

from sentry.runner.commands.presenters.presenterdelegator import PresenterDelegator


@pytest.mark.django_db
@responses.activate
def test_contains_attributes() -> None:
    expected_methods = [
        "set",
        "unset",
        "update",
        "channel_update",
        "drift",
        "unregistered",
        "invalid_type",
        "flush",
    ]

    presenter_delegator = PresenterDelegator("options-automator", dry_run=True)
    for method_name in expected_methods:
        assert hasattr(presenter_delegator, method_name)
