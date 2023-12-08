from __future__ import annotations

from typing import Any, Dict, Sequence

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.rules import MATCH_CHOICES, EventState, MatchType
from sentry.rules.conditions.base import EventCondition
from sentry.rules.history.preview_strategy import DATASET_TO_COLUMN_NAME, get_dataset_columns
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.types.condition_activity import ConditionActivity

# Maps attributes to snuba columns
ATTR_CHOICES = {
    "message": Columns.MESSAGE,
    "platform": Columns.PLATFORM,
    "environment": Columns.MESSAGE,
    "type": Columns.TYPE,
    "error.handled": Columns.ERROR_HANDLED,
    "error.unhandled": Columns.ERROR_HANDLED,
    "error.main_thread": Columns.ERROR_MAIN_THREAD,
    "exception.type": Columns.ERROR_TYPE,
    "exception.value": Columns.ERROR_VALUE,
    "user.id": Columns.USER_ID,
    "user.email": Columns.USER_EMAIL,
    "user.username": Columns.USER_USERNAME,
    "user.ip_address": Columns.USER_IP_ADDRESS,
    "http.method": Columns.HTTP_METHOD,
    "http.url": Columns.HTTP_URL,
    "http.status_code": Columns.HTTP_STATUS_CODE,
    "sdk.name": Columns.SDK_NAME,
    "stacktrace.code": None,
    "stacktrace.module": Columns.STACK_MODULE,
    "stacktrace.filename": Columns.STACK_FILENAME,
    "stacktrace.abs_path": Columns.STACK_ABS_PATH,
    "stacktrace.package": Columns.STACK_PACKAGE,
    "unreal.crashtype": Columns.UNREAL_CRASH_TYPE,
    "app.in_foreground": Columns.APP_IN_FOREGROUND,
}


class EventAttributeForm(forms.Form):
    attribute = forms.ChoiceField(choices=[(a, a) for a in ATTR_CHOICES.keys()])
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()))
    value = forms.CharField(widget=forms.TextInput(), required=False)


class EventAttributeCondition(EventCondition):
    """
    Attributes are a mapping of <logical-key>.<property>.

    For example:

    - message
    - platform
    - exception.{type,value}
    - user.{id,ip_address,email,FIELD}
    - http.{method,url}
    - stacktrace.{code,module,filename,abs_path,package}
    - extra.{FIELD}
    """

    id = "sentry.rules.conditions.event_attribute.EventAttributeCondition"
    form_cls = EventAttributeForm
    label = "The event's {attribute} value {match} {value}"

    form_fields = {
        "attribute": {
            "type": "choice",
            "placeholder": "i.e. exception.type",
            "choices": [[a, a] for a in ATTR_CHOICES.keys()],
        },
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def _get_attribute_values(self, event: GroupEvent, attr: str) -> Sequence[object | None]:
        # TODO(dcramer): we should validate attributes (when we can) before
        path = attr.split(".")

        if path[0] == "platform":
            if len(path) != 1:
                return []
            return [event.platform]

        if path[0] == "message":
            if len(path) != 1:
                return []
            return [event.message, event.search_message]
        elif path[0] == "environment":
            return [event.get_tag("environment")]

        elif path[0] == "type":
            return [event.data["type"]]

        elif len(path) == 1:
            return []

        elif path[0] == "extra":
            path.pop(0)
            value = event.data["extra"]
            while path:
                bit = path.pop(0)
                value = value.get(bit)
                if not value:
                    return []

            if isinstance(value, (list, tuple)):
                return value
            return [value]

        elif len(path) != 2:
            return []

        elif path[0] == "exception":
            if path[1] not in ("type", "value"):
                return []

            return [getattr(e, path[1]) for e in event.interfaces["exception"].values]

        elif path[0] == "error":
            # TODO: add support for error.main_thread

            if path[1] not in ("handled", "unhandled"):
                return []

            # Flip "handled" to "unhandled"
            negate = path[1] == "unhandled"

            return [
                e.mechanism.handled != negate
                for e in event.interfaces["exception"].values
                if e.mechanism is not None and getattr(e.mechanism, "handled") is not None
            ]

        elif path[0] == "user":
            if path[1] in ("id", "ip_address", "email", "username"):
                return [getattr(event.interfaces["user"], path[1])]
            return [getattr(event.interfaces["user"].data, path[1])]

        elif path[0] == "http":
            if path[1] in ("url", "method"):
                return [getattr(event.interfaces["request"], path[1])]
            elif path[1] in ("status_code"):
                contexts = event.data["contexts"]
                response = contexts.get("response")
                if response is None:
                    response = {}
                return [response.get(path[1])]

            return []

        elif path[0] == "sdk":
            if path[1] != "name":
                return []
            return [event.data["sdk"].get(path[1])]

        elif path[0] == "stacktrace":
            stacktrace = event.interfaces.get("stacktrace")
            if stacktrace:
                stacks = [stacktrace]
            else:
                stacks = [
                    e.stacktrace for e in event.interfaces["exception"].values if e.stacktrace
                ]
            result = []
            for st in stacks:
                for frame in st.frames:
                    if path[1] in ("filename", "module", "abs_path", "package"):
                        result.append(getattr(frame, path[1]))
                    elif path[1] == "code":
                        if frame.pre_context:
                            result.extend(frame.pre_context)
                        if frame.context_line:
                            result.append(frame.context_line)
                        if frame.post_context:
                            result.extend(frame.post_context)
            return result

        elif path[0] == "device":
            if path[1] in (
                "screen_density",
                "screen_dpi",
                "screen_height_pixels",
                "screen_width_pixels",
            ):
                contexts = event.data["contexts"]
                device = contexts.get("device")
                if device is None:
                    device = []
                return [device.get(path[1])]

        elif path[0] == "unreal":
            if path[1] == "crash_type":
                contexts = event.data["contexts"]
                unreal = contexts.get("unreal")
                if unreal is None:
                    unreal = {}
                return [unreal.get(path[1])]

        elif path[0] == "app":
            if path[1] in ("in_foreground"):
                contexts = event.data["contexts"]
                response = contexts.get("app")
                if response is None:
                    response = {}
                return [response.get(path[1])]

            return []

        return []

    def render_label(self) -> str:
        data = {
            "attribute": self.data["attribute"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def _passes(self, attribute_values: Sequence[object | None]) -> bool:
        match = self.get_option("match")
        value = self.get_option("value")

        if not ((match and value) or (match in (MatchType.IS_SET, MatchType.NOT_SET))):
            return False

        value = value.lower()

        values = [str(v).lower() for v in attribute_values if v is not None]

        if match == MatchType.EQUAL:
            for a_value in values:
                if a_value == value:
                    return True
            return False

        elif match == MatchType.NOT_EQUAL:
            for a_value in values:
                if a_value == value:
                    return False
            return True

        elif match == MatchType.STARTS_WITH:
            for a_value in values:
                if a_value.startswith(value):
                    return True
            return False

        elif match == MatchType.NOT_STARTS_WITH:
            for a_value in values:
                if a_value.startswith(value):
                    return False
            return True

        elif match == MatchType.ENDS_WITH:
            for a_value in values:
                if a_value.endswith(value):
                    return True
            return False

        elif match == MatchType.NOT_ENDS_WITH:
            for a_value in values:
                if a_value.endswith(value):
                    return False
            return True

        elif match == MatchType.CONTAINS:
            for a_value in values:
                if value in a_value:
                    return True
            return False

        elif match == MatchType.NOT_CONTAINS:
            for a_value in values:
                if value in a_value:
                    return False
            return True

        elif match == MatchType.IS_SET:
            return bool(values)

        elif match == MatchType.NOT_SET:
            return not values

        raise RuntimeError("Invalid Match")

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        attr = self.get_option("attribute", "")
        try:
            attribute_values = self._get_attribute_values(event, attr.lower())
        except KeyError:
            attribute_values = []

        return self._passes(attribute_values)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            attr = self.get_option("attribute").lower()
            dataset = condition_activity.data["dataset"]
            column = ATTR_CHOICES[attr]
            if column is None:
                raise NotImplementedError

            column = getattr(column.value, DATASET_TO_COLUMN_NAME[dataset])
            attribute_values = event_map[condition_activity.data["event_id"]][column]

            if isinstance(attribute_values, str):
                attribute_values = [attribute_values]

            # flip values, since the queried column is "error.handled"
            if attr == "error.unhandled":
                attribute_values = [not value for value in attribute_values]

            return self._passes(attribute_values)
        except (TypeError, KeyError):
            return False

    def get_event_columns(self) -> Dict[Dataset, Sequence[str]]:
        attr = self.get_option("attribute")
        column = ATTR_CHOICES[attr]
        if column is None:
            raise NotImplementedError
        columns: Dict[Dataset, Sequence[str]] = get_dataset_columns([column])
        return columns
