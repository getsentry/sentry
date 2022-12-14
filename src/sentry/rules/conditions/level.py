from __future__ import annotations

from typing import Any, Callable, Dict, Sequence, Tuple

from django import forms

from sentry.constants import LOG_LEVELS, LOG_LEVELS_MAP
from sentry.eventstore.models import GroupEvent
from sentry.rules import LEVEL_MATCH_CHOICES as MATCH_CHOICES
from sentry.rules import EventState, MatchType
from sentry.rules.conditions.base import EventCondition
from sentry.rules.history.preview_strategy import get_dataset_columns
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.types.condition_activity import ConditionActivity

key: Callable[[Tuple[int, str]], int] = lambda x: x[0]
LEVEL_CHOICES = {f"{k}": v for k, v in sorted(LOG_LEVELS.items(), key=key, reverse=True)}


class LevelEventForm(forms.Form):  # type: ignore
    level = forms.ChoiceField(choices=list(LEVEL_CHOICES.items()))
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()))


class LevelCondition(EventCondition):
    id = "sentry.rules.conditions.level.LevelCondition"
    form_cls = LevelEventForm
    label = "The event's level is {match} {level}"
    form_fields = {
        "level": {"type": "choice", "choices": list(LEVEL_CHOICES.items())},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
    }

    def _passes(self, level_name: str) -> bool:
        desired_level_raw = self.get_option("level")
        desired_match = self.get_option("match")

        if not (desired_level_raw and desired_match):
            return False

        desired_level = int(desired_level_raw)
        # Fetch the event level from the tags since event.level is
        # event.group.level which may have changed
        try:
            level: int = LOG_LEVELS_MAP[level_name]
        except KeyError:
            return False

        if desired_match == MatchType.EQUAL:
            return level == desired_level
        elif desired_match == MatchType.GREATER_OR_EQUAL:
            return level >= desired_level
        elif desired_match == MatchType.LESS_OR_EQUAL:
            return level <= desired_level
        return False

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        return self._passes(event.get_tag("level"))

    def render_label(self) -> str:
        data = {
            "level": LEVEL_CHOICES[self.data["level"]],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def get_event_columns(self) -> Dict[Dataset, Sequence[str]]:
        columns: Dict[Dataset, Sequence[str]] = get_dataset_columns(
            [Columns.TAGS_KEY, Columns.TAGS_VALUE]
        )
        return columns

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            level = event_map[condition_activity.data["event_id"]]["tags"]["level"]
            return self._passes(level)
        except (TypeError, KeyError):
            return False
