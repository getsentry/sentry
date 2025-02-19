from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import sentry_sdk
from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.rules import MATCH_CHOICES, EventState, MatchType, match_values
from sentry.rules.conditions.base import EventCondition
from sentry.rules.history.preview_strategy import DATASET_TO_COLUMN_NAME, get_dataset_columns
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.types.condition_activity import ConditionActivity
from sentry.utils.registry import NoRegistrationExistsError, Registry


@dataclass(frozen=True)
class AttributeHandler(ABC):
    minimum_path_length: int

    @classmethod
    def handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if len(path) < cls.minimum_path_length:
            return []
        return cls._handle(path, event)

    @classmethod
    @abstractmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        raise NotImplementedError


attribute_registry = Registry[AttributeHandler]()


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
    "unreal.crash_type": Columns.UNREAL_CRASH_TYPE,
    "app.in_foreground": Columns.APP_IN_FOREGROUND,
    "os.distribution_name": Columns.OS_DISTRIBUTION_NAME,
    "os.distribution_version": Columns.OS_DISTRIBUTION_VERSION,
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

    def render_label(self) -> str:
        data = {
            "attribute": self.data["attribute"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def _passes(self, attribute_values: Sequence[object | None]) -> bool:
        option_match = self.get_option("match")
        option_value = self.get_option("value")

        if not (
            (option_match and option_value)
            or (option_match in (MatchType.IS_SET, MatchType.NOT_SET))
        ):
            return False

        option_value = option_value.lower()

        attr_values = [str(v).lower() for v in attribute_values if v is not None]

        # NOTE: IS_SET condition differs btw tagged_event and event_attribute so not handled by match_values
        if option_match == MatchType.IS_SET:
            return bool(attr_values)

        elif option_match == MatchType.NOT_SET:
            return not attr_values

        return match_values(
            group_values=attr_values, match_value=option_value, match_type=option_match
        )

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        attr = self.get_option("attribute", "")
        path = attr.split(".")

        first_attr = path[0]
        try:
            attr_handler = attribute_registry.get(first_attr)
        except NoRegistrationExistsError:
            attr_handler = None

        if not attr_handler:
            attribute_values = []
        else:
            try:
                attribute_values = attr_handler.handle(path, event)
            except KeyError as e:
                attribute_values = []
                sentry_sdk.capture_exception(e)

        return self._passes(attribute_values)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: dict[str, Any]
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

    def get_event_columns(self) -> dict[Dataset, Sequence[str]]:
        attr = self.get_option("attribute")
        column = ATTR_CHOICES[attr]
        if column is None:
            raise NotImplementedError
        columns: dict[Dataset, Sequence[str]] = get_dataset_columns([column])
        return columns

    def get_form_instance(self) -> EventAttributeForm:
        return EventAttributeForm(self.data)


# Register attribute handlers
@attribute_registry.register("platform")
class PlatformAttributeHandler(AttributeHandler):
    minimum_path_length = 1

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        return [str(event.platform)]


@attribute_registry.register("message")
class MessageAttributeHandler(AttributeHandler):
    minimum_path_length = 1

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        return [event.message, event.search_message]


@attribute_registry.register("environment")
class EnvironmentAttributeHandler(AttributeHandler):
    minimum_path_length = 1

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        return [str(event.get_tag("environment"))]


@attribute_registry.register("type")
class TypeAttributeHandler(AttributeHandler):
    minimum_path_length = 1

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        return [str(event.data.get("type"))]


@attribute_registry.register("extra")
class ExtraAttributeHandler(AttributeHandler):
    minimum_path_length = 1

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        path.pop(0)
        value = event.data.get("extra", {})
        while path:
            bit = path.pop(0)
            value = value.get(bit)
            if not value:
                return []

        if isinstance(value, (list, tuple)):
            return list(value)
        return [value]


@attribute_registry.register("exception")
class ExceptionAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] not in ("type", "value"):
            return []

        values = getattr(event.interfaces.get("exception"), "values", [])
        result = []
        for e in values:
            if e is None:
                continue

            if hasattr(e, path[1]):
                result.append(getattr(e, path[1]))

        return result


@attribute_registry.register("error")
class ErrorAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        # TODO: add support for error.main_thread

        if path[1] not in ("handled", "unhandled"):
            return []

        # Flip "handled" to "unhandled"
        negate = path[1] == "unhandled"

        return [
            e.mechanism.handled != negate
            for e in getattr(event.interfaces.get("exception"), "values", [])
            if getattr(e, "mechanism") is not None and getattr(e.mechanism, "handled") is not None
        ]


@attribute_registry.register("user")
class UserAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] not in ("id", "ip_address", "email", "username"):
            return []

        result = getattr(event.interfaces.get("user", {}), path[1], None)
        return [result] if result is not None else []


@attribute_registry.register("http")
class HttpAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] in ("url", "method"):
            result = getattr(event.interfaces.get("request"), path[1], None)
            return [result] if result is not None else []
        elif path[1] in ("status_code"):
            contexts = event.data.get("contexts", {})
            response = contexts.get("response")
            if response is None:
                response = {}
            return [response.get(path[1])]

        return []


@attribute_registry.register("sdk")
class SdkAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] != "name":
            return []
        return [event.data.get("sdk", {}).get(path[1])]


@attribute_registry.register("stacktrace")
class StacktraceAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        stacktrace = event.interfaces.get("stacktrace")
        if stacktrace:
            stacks = [stacktrace]
        else:
            stacks = [
                getattr(e, "stacktrace")
                for e in getattr(event.interfaces.get("exception"), "values", [])
                if getattr(e, "stacktrace", None)
            ]
        result = []
        for st in stacks:
            for frame in st.frames:
                if path[1] in ("filename", "module", "abs_path", "package"):
                    value = getattr(frame, path[1], None)
                    if value is not None:
                        result.append(value)
                elif path[1] == "code":
                    if frame.pre_context:
                        result.extend(frame.pre_context)
                    if frame.context_line:
                        result.append(frame.context_line)
                    if frame.post_context:
                        result.extend(frame.post_context)
        return result


@attribute_registry.register("device")
class DeviceAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] in (
            "screen_density",
            "screen_dpi",
            "screen_height_pixels",
            "screen_width_pixels",
        ):
            contexts = event.data.get("contexts", {})
            device = contexts.get("device")
            if device is None:
                device = []
            return [device.get(path[1])]

        return []


@attribute_registry.register("unreal")
class UnrealAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] == "crash_type":
            contexts = event.data.get("contexts", {})
            unreal = contexts.get("unreal")
            if unreal is None:
                unreal = {}
            return [unreal.get(path[1])]

        return []


@attribute_registry.register("app")
class AppAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] in ("in_foreground"):
            contexts = event.data.get("contexts", {})
            response = contexts.get("app")
            if response is None:
                response = {}
            return [response.get(path[1])]

        return []


@attribute_registry.register("os")
class OsAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] in ("distribution_name", "distribution_version"):
            contexts = event.data.get("contexts", {})
            os_context = contexts.get("os")
            if os_context is None:
                os_context = {}
            return [os_context.get(path[1])]
        return []
