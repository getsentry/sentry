from sentry.integrations.slack.actions.message_action import SlackMessageAction
from sentry.notifications.utils.actions import BaseMessageAction
from sentry.testutils.cases import TestCase


class TestToSlackMessageAction(TestCase):
    def setUp(self) -> None:
        self.base_action = BaseMessageAction(
            name="test_action",
            type="button",
            label="Test Button",
            url="https://example.com",
            value="test_value",
            action_id="test_action_id",
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )

    def test_to_slack_message_action(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert isinstance(slack_action, SlackMessageAction)

    def test_name_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.name == self.base_action.name

    def test_type_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.type == self.base_action.type

    def test_label_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.label == self.base_action.label

    def test_url_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.url == self.base_action.url

    def test_value_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.value == self.base_action.value

    def test_action_id_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.action_id == self.base_action.action_id

    def test_block_id_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.block_id == self.base_action.block_id

    def test_option_groups_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.option_groups == self.base_action.option_groups

    def test_selected_options_conversion(self) -> None:
        slack_action = SlackMessageAction.to_slack_message_action(self.base_action)
        assert slack_action.selected_options == self.base_action.selected_options


class TestGetButtonTextValue(TestCase):
    def test_uses_label_when_populated(self) -> None:
        label = "Test Button"
        slack_action = SlackMessageAction(
            name="test_action",
            type="button",
            label=label,
            url="https://example.com",
            value="test_value",
            action_id="test_action_id",
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )
        button_text = slack_action._get_button_text_value()
        assert button_text == label

    def test_uses_name_when_label_is_empty(self) -> None:
        name = "test_action"
        slack_action = SlackMessageAction(
            name=name,
            type="button",
            label="",
            url="https://example.com",
            value="test_value",
            action_id="test_action_id",
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )
        button_text = slack_action._get_button_text_value()
        assert button_text == name


class _BaseTestSlackMessageAction(TestCase):
    def setUp(self) -> None:
        self.default_slack_action = SlackMessageAction(
            name="test_action",
            type="button",
            label="Test Button",
            url="https://example.com",
            value="test_value",
            action_id="test_action_id",
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )


class TestGetButtonTest(_BaseTestSlackMessageAction):
    def test_has_type_key(self) -> None:
        text_obj = self.default_slack_action._get_button_text()
        assert "type" in text_obj

    def test_has_correct_type_value(self) -> None:
        text_obj = self.default_slack_action._get_button_text()
        assert text_obj["type"] == "plain_text"

    def test_has_text_key(self) -> None:
        text_obj = self.default_slack_action._get_button_text()
        assert "text" in text_obj

    def test_has_correct_text_value(self) -> None:
        text_obj = self.default_slack_action._get_button_text()
        assert text_obj["text"] == self.default_slack_action._get_button_text_value()


class TestGetButton(_BaseTestSlackMessageAction):
    def test_type_key_exists(self) -> None:
        button = self.default_slack_action.get_button()
        assert "type" in button

    def test_type_is_button(self) -> None:
        button = self.default_slack_action.get_button()
        button_type = button["type"]
        assert button_type == "button"

    def test_text_key_exists(self) -> None:
        button = self.default_slack_action.get_button()
        assert "text" in button

    def test_button_action_id_overwrites_value(self) -> None:
        slack_action = SlackMessageAction(
            name="test_action",
            type="button",
            label="Test Button",
            url=None,
            value="test_value",
            action_id="test_action_id",
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )
        button = slack_action.get_button()
        assert button["action_id"] == "test_action_id"

    def test_button_url_overwrites_value(self) -> None:
        slack_action = SlackMessageAction(
            name="test_action",
            type="button",
            label="Test Button",
            url="https://example.com",
            value="test_value",
            action_id=None,
            block_id="test_block_id",
            option_groups={"test_group": "test_option_group"},
            selected_options={"test_option": "test_option_value"},
        )
        button = slack_action.get_button()
        assert button["value"] == "link_clicked"

    def test_all_overwrites_at_once(self) -> None:
        button = self.default_slack_action.get_button()
        assert button["url"] == "https://example.com"
        assert button["value"] == "link_clicked"
        assert button["action_id"] == "test_action_id"
