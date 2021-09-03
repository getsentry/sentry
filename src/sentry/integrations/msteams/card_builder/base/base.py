from abc import ABC
from typing import Any, Optional, Sequence

from sentry.integrations.base import AbstractMessageBuilder


class MSTeamsMessageBuilder(AbstractMessageBuilder, ABC):
    def build(self) -> Any:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def _build(
        text: str,
        title: Optional[str] = None,
        footer: Optional[str] = None,
        actions: Optional[Sequence[Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Helper to DRY up Slack specific fields.

        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] footer: Footer text.
        :param kwargs: Everything else.
        """
        body = []
        if title:
            body.append(title)
        if text:
            body.append(text)
        if footer:
            body.append(footer)

        # TODO MARCOS should this be the buttons instead?
        for action in actions or []:
            body.append(action)

        return {
            "body": body,
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
        }
