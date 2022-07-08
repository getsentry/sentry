import pytest

from sentry.integrations.msteams.card_builder.base.base import ActionType, MSTeamsMessageBuilder
from sentry.testutils import TestCase


class SimpleMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(
            title=self.get_text_block("title"),
            text=self.get_text_block("text"),
            fields=[self.get_text_block("fields")],
            actions=[self.get_action_block(ActionType.OPEN_URL, "button", url="url")],
        )


class MissingActionParamsMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(actions=[self.get_action_block(ActionType.OPEN_URL, "button")])


class ColumnMessageBuilder(MSTeamsMessageBuilder):
    def build(self):
        return self._build(
            text=self.get_column_set_block(
                self.get_column_block(self.get_text_block("column1")),
                self.get_column_block(self.get_text_block("column2")),
            )
        )


class MSTeamsMessageBuilderTest(TestCase):
    def test_simple(self):
        card = SimpleMessageBuilder().build()

        assert "body" in card
        assert 3 == len(card["body"])
        assert "title" == card["body"][0]["text"]

        assert "actions" in card
        assert 1 == len(card["actions"])
        assert card["actions"][0]["type"] == ActionType.OPEN_URL
        assert card["actions"][0]["title"] == "button"

    def test_missing_action_params(self):
        with pytest.raises(KeyError):
            _ = MissingActionParamsMessageBuilder().build()

    def test_columns(self):
        card = ColumnMessageBuilder().build()

        body = card["body"]
        assert 1 == len(body)

        column_set = body[0]
        assert "ColumnSet" == column_set["type"]
        assert 2 == len(column_set)

        column = column_set["columns"][0]
        assert "Column" == column["type"]
        assert "column1" == column["items"][0]["text"]
