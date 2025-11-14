from __future__ import annotations

from typing import Any, TypedDict, int

from .actions import EnhancementAction
from .matchers import EnhancementMatch, ExceptionFieldMatch, MatchFrame, ReturnValueCache


class EnhancementRuleDict(TypedDict):
    match: dict[str, str]
    actions: list[str]


class EnhancementRule:
    def __init__(self, matchers: list[EnhancementMatch], actions: list[EnhancementAction]):
        self.matchers = matchers

        self._exception_matchers = []
        self._other_matchers = []
        for matcher in matchers:
            if isinstance(matcher, ExceptionFieldMatch):
                self._exception_matchers.append(matcher)
            else:
                self._other_matchers.append(matcher)

        self.actions = actions
        self.has_classifier_actions = any(action.is_classifier for action in actions)
        self.has_contributes_actions = any(action.sets_contributes for action in actions)

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

    def get_matching_frame_actions(
        self,
        match_frames: list[MatchFrame],
        exception_data: dict[str, Any],
        in_memory_cache: ReturnValueCache,
    ) -> list[tuple[int, EnhancementAction]]:
        """Given a frame returns all the matching actions based on this rule.
        If the rule does not match `None` is returned.
        """
        if not self.matchers:
            return []

        # 1 - Check if exception matchers match
        for m in self._exception_matchers:
            if not m.matches_frame(match_frames, None, exception_data, in_memory_cache):
                return []

        rv = []

        # 2 - Check if frame matchers match
        for idx, _ in enumerate(match_frames):
            if all(
                m.matches_frame(match_frames, idx, exception_data, in_memory_cache)
                for m in self._other_matchers
            ):
                for action in self.actions:
                    rv.append((idx, action))

        return rv

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
