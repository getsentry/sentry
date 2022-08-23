from typing import List, Sequence, Tuple, Union, cast

from sentry.grouping.mypyc.matchers import ExceptionFieldMatch, Match
from sentry.grouping.mypyc.utils import ExceptionData, MatchFrame, MatchingCache

from .actions import Action, ActionConfigStructure

RuleConfigStructure = List[Union[List[str], List[ActionConfigStructure]]]


class Rule:
    def __init__(self, matchers: Sequence[Match], actions: Sequence[Action]):
        self.matchers = matchers

        self._exception_matchers = []
        self._other_matchers = []
        for matcher in matchers:
            if isinstance(matcher, ExceptionFieldMatch):
                self._exception_matchers.append(matcher)
            else:
                self._other_matchers.append(matcher)

        self.actions = actions
        self._is_updater = any(action.is_updater for action in actions)
        self._is_modifier = any(action.is_modifier for action in actions)

    @property
    def matcher_description(self) -> str:
        rv = " ".join(x.description for x in self.matchers)
        for action in self.actions:
            rv = f"{rv} {action}"
        return rv

    @property
    def is_modifier(self) -> bool:
        """Does this rule modify the frame?"""
        return self._is_modifier

    @property
    def is_updater(self) -> bool:
        """Does this rule update grouping components?"""
        return self._is_updater

    def get_matching_frame_actions(
        self,
        frames: Sequence[MatchFrame],
        platform: str,
        exception_data: ExceptionData,  # TODO: move these types to a common module
        cache: MatchingCache,
    ) -> List[Tuple[int, Action]]:
        """Given a frame returns all the matching actions based on this rule.
        If the rule does not match `None` is returned.
        """
        if not self.matchers:
            return []

        # 1 - Check if exception matchers match
        for m in self._exception_matchers:
            if not m.matches_frame(frames, -1, platform, exception_data, cache):
                return []

        rv = []

        # 2 - Check if frame matchers match
        for idx, _ in enumerate(frames):
            if all(
                m.matches_frame(frames, idx, platform, exception_data, cache)
                for m in self._other_matchers
            ):
                for action in self.actions:
                    rv.append((idx, action))

        return rv

    def _to_config_structure(self, version: int) -> RuleConfigStructure:
        return [
            [x._to_config_structure(version) for x in self.matchers],
            [x._to_config_structure(version) for x in self.actions],
        ]

    @classmethod
    def _from_config_structure(cls, tuple: RuleConfigStructure, version: int) -> "Rule":
        matchers = cast(List[str], tuple[0])
        actions = cast(List[ActionConfigStructure], tuple[1])
        return Rule(
            [Match._from_config_structure(x, version) for x in matchers],
            [Action._from_config_structure(x, version) for x in actions],
        )
