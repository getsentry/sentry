import pytest
import responses
from django.test import override_settings

from sentry.runner.commands.presenters.webhookpresenter import WebhookPresenter
from sentry.utils import json


@pytest.mark.django_db
@responses.activate
@override_settings(OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL="https://test/", SENTRY_REGION="test_region")
def test_is_slack_enabled():
    responses.add(responses.POST, "https://test/", status=200)

    presenter = WebhookPresenter("options-automator")
    assert presenter.is_webhook_enabled()
    presenter.set("option1", "value1")
    presenter.set("option2", "value2")

    presenter.unset("option3")
    presenter.unset("option4")

    presenter.update("option5", "db_value5", "value5")
    presenter.update("option6", "db_value6", "value6")

    presenter.channel_update("option7")
    presenter.channel_update("option8")

    presenter.drift("option9", "db_value9")
    presenter.drift("option10", "db_value10")

    presenter.not_writable("option11", "error_reason11")
    presenter.not_writable("option12", "error_reason12")

    presenter.unregistered("option13")
    presenter.unregistered("option14")

    presenter.invalid_type("option15", str, int)
    presenter.invalid_type("option16", float, int)

    presenter.flush()

    expected_json_data = {
        "region": "test_region",
        "source": "options-automator",
        "drifted_options": [
            {"option_name": "option9", "option_value": "db_value9"},
            {"option_name": "option10", "option_value": "db_value10"},
        ],
        "updated_options": [
            {"option_name": "option5", "db_value": "db_value5", "value": "value5"},
            {"option_name": "option6", "db_value": "db_value6", "value": "value6"},
        ],
        "set_options": [
            {"option_name": "option1", "option_value": "value1"},
            {"option_name": "option2", "option_value": "value2"},
        ],
        "unset_options": ["option3", "option4"],
        "not_writable_options": [
            {"option_name": "option11", "error_msg": "error_reason11"},
            {"option_name": "option12", "error_msg": "error_reason12"},
        ],
        "unregistered_options": ["option13", "option14"],
        "invalid_type_options": [
            {
                "option_name": "option15",
                "got_type": "<class 'str'>",
                "expected_type": "<class 'int'>",
            },
            {
                "option_name": "option16",
                "got_type": "<class 'float'>",
                "expected_type": "<class 'int'>",
            },
        ],
    }

    assert responses.calls[0].response.status_code == 200
    assert expected_json_data == json.loads(responses.calls[0].request.body)


@pytest.mark.django_db
@responses.activate
@override_settings(OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL="https://test/", SENTRY_REGION="test_region")
def test_slack_presenter_empty():
    presenter = WebhookPresenter("options-automator")
    assert presenter.is_webhook_enabled()
    presenter.flush()

    assert len(responses.calls) == 0


@pytest.mark.django_db
@responses.activate
@override_settings(OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL="https://test/", SENTRY_REGION="test_region")
def test_slack_presenter_methods_with_different_types():
    responses.add(responses.POST, "https://test/", status=200)

    presenter = WebhookPresenter("options-automator")
    assert presenter.is_webhook_enabled()

    presenter.set("str_option", "string_value")
    presenter.set("bool_option", True)
    presenter.set("int_option", 123)
    presenter.set("float_option", 3.14)
    presenter.set("dict_option", {"key": "value"})
    presenter.invalid_type("key1", str, int)
    presenter.update("updated", 1.0, 0.0)
    presenter.drift("drifted", {"key": "value"})

    presenter.flush()

    expected_json_data = {
        "region": "test_region",
        "source": "options-automator",
        "drifted_options": [{"option_name": "drifted", "option_value": "{'key': 'value'}"}],
        "updated_options": [{"option_name": "updated", "db_value": "1.0", "value": "0.0"}],
        "set_options": [
            {"option_name": "str_option", "option_value": "string_value"},
            {"option_name": "bool_option", "option_value": "True"},
            {"option_name": "int_option", "option_value": "123"},
            {"option_name": "float_option", "option_value": "3.14"},
            {"option_name": "dict_option", "option_value": "{'key': 'value'}"},
        ],
        "unset_options": [],
        "not_writable_options": [],
        "unregistered_options": [],
        "invalid_type_options": [
            {
                "option_name": "key1",
                "got_type": "<class 'str'>",
                "expected_type": "<class 'int'>",
            }
        ],
    }

    assert responses.calls[0].response.status_code == 200
    assert expected_json_data == json.loads(responses.calls[0].request.body)
