from __future__ import annotations

from functools import cached_property
from typing import Any, TypedDict

from .actions import EnhancementAction
from .matchers import EnhancementMatch


class EnhancementRuleDict(TypedDict):
    match: dict[str, str]
    actions: list[str]


class EnhancementRule:
    def __init__(self, matchers: list[EnhancementMatch], actions: list[EnhancementAction]):
        self.matchers = matchers
        self.actions = actions

    @cached_property
    def has_classifier_actions(self) -> bool:
        return any(action.is_classifier for action in self.actions)

    @cached_property
    def has_contributes_actions(self) -> bool:
        return any(action.sets_contributes for action in self.actions)

    def __repr__(self) -> str:
        return f"<EnhancementRule {self.text}>"

    def __hash__(self):
        return hash(self.text)

    def __eq__(self, other):
        return self.text == other.text

    @property
    def text(self) -> str:
        matchers = " ".join(matcher.description for matcher in self.matchers)
        actions = " ".join(str(action) for action in self.actions)
        return f"{matchers} {actions}"

    def as_classifier_rule(self) -> EnhancementRule | None:
        actions = [action for action in self.actions if action.is_classifier]
        if actions:
            return EnhancementRule(self.matchers, actions)
        else:
            return None

    def as_contributes_rule(self) -> EnhancementRule | None:
        actions = [action for action in self.actions if action.sets_contributes]
        if actions:
            return EnhancementRule(self.matchers, actions)
        else:
            return None

    def as_dict(self) -> EnhancementRuleDict:
        matchers = {}
        for matcher in self.matchers:
            matchers[matcher.key] = matcher.pattern
        return {"match": matchers, "actions": [str(action) for action in self.actions]}

    def _to_config_structure(self, version: int) -> list[Any]:
        return [
            [matcher._to_config_structure(version) for matcher in self.matchers],
            [action._to_config_structure(version) for action in self.actions],
        ]

    @classmethod
    def _from_config_structure(
        cls,
        config_structure: list[Any],
        version: int,
    ) -> EnhancementRule:
        matcher_abbreviations, encoded_actions = config_structure
        return EnhancementRule(
            [
                EnhancementMatch._from_config_structure(matcher, version)
                for matcher in matcher_abbreviations
            ],
            [
                EnhancementAction._from_config_structure(action, version)
                for action in encoded_actions
            ],
        )
