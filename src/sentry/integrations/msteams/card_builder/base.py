from __future__ import annotations

from typing import Any, Sequence

from sentry.integrations.msteams.card_builder.block import (
    Action,
    AdaptiveCard,
    Block,
    create_text_block,
)


class MSTeamsMessageBuilder:
    def build(
        self,
        text: str | Block | None = None,
        title: str | Block | None = None,
        fields: Sequence[str | Block | None] | None = None,
        footer: str | Block | None = None,
        actions: list[Action] | None = None,
        **kwargs: Any,
    ) -> AdaptiveCard:
        """
        Helper to DRY up MS Teams specific fields.
        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] footer: Footer text.
        :param kwargs: Everything else.
        """
        body = []

        fields = fields or []

        items = [title, text, *fields, footer]

        for item in items:
            if item:
                # NOTE: If the given item is string and not a `block`,
                # then it will be converted to a text block.
                if isinstance(item, str):
                    item = create_text_block(item)

                body.append(item)

        return {
            "body": body,
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "actions": actions or [],
            "msteams": {"width": "Full"},
        }
