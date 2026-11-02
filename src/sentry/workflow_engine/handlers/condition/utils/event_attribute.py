from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar

from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.events import Columns
from sentry.utils.registry import Registry


class AttributeHandler(ABC):
    minimum_path_length: ClassVar[int]

    @classmethod
    def handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if len(path) < cls.minimum_path_length:
            return []
        return cls._handle(path, event)

    @classmethod
    @abstractmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        raise NotImplementedError


attribute_registry = Registry[type[AttributeHandler]]()


# Maps attributes to snuba columns
ATTR_CHOICES: dict[str, Columns | None] = {
    "message": Columns.MESSAGE,
    "platform": Columns.PLATFORM,
    "environment": Columns.ENVIRONMENT,
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
    "symbolicated_in_app": Columns.SYMBOLICATED_IN_APP,
    "ota_updates.channel": Columns.OTA_UPDATES_CHANNEL,
    "ota_updates.runtime_version": Columns.OTA_UPDATES_RUNTIME_VERSION,
    "ota_updates.update_id": Columns.OTA_UPDATES_UPDATE_ID,
}


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
            if e is not None
            and getattr(e, "mechanism") is not None
            and getattr(e.mechanism, "handled") is not None
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


@attribute_registry.register("ota_updates")
class ExpoUpdatesAttributeHandler(AttributeHandler):
    minimum_path_length = 2

    @classmethod
    def _handle(cls, path: list[str], event: GroupEvent) -> list[str]:
        if path[1] in ("channel", "runtime_version", "update_id"):
            contexts = event.data.get("contexts", {})
            ota_updates_context = contexts.get("ota_updates")
            if ota_updates_context is None:
                ota_updates_context = {}
            return [ota_updates_context.get(path[1])]
        return []
