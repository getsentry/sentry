from __future__ import absolute_import

from enum import Enum
from collections import namedtuple

Column = namedtuple("Column", "group_name event_name transaction_name discover_name alias")


class Columns(Enum):
    """
    Value is a tuple of (internal Events name, internal Transaction name, internal
    Discover name, external alias)
    None means the column is not available in that dataset.
    """

    EVENT_ID = Column("events.event_id", "event_id", "event_id", "event_id", "id")
    GROUP_ID = Column("events.group_id", "group_id", None, "group_id", "issue.id")
    PROJECT_ID = Column("events.project_id", "project_id", "project_id", "project_id", "project.id")
    TIMESTAMP = Column("events.timestamp", "timestamp", "finish_ts", "timestamp", "timestamp")
    TIME = Column("events.time", "time", "bucketed_end", "time", "time")
    CULPRIT = Column("events.culprit", "culprit", None, "culprit", "culprit")
    LOCATION = Column("events.location", "location", None, "location", "location")
    MESSAGE = Column("events.message", "message", "transaction_name", "message", "message")
    PLATFORM = Column("events.platform", "platform", "platform", "platform", "platform.name")
    ENVIRONMENT = Column(
        "events.environment", "environment", "environment", "environment", "environment"
    )
    RELEASE = Column(
        "events.tags[sentry:release]", "tags[sentry:release]", "release", "release", "release"
    )
    TITLE = Column("events.title", "title", "transaction_name", "title", "title")
    TYPE = Column("events.type", "type", None, "type", "event.type")
    TAGS_KEY = Column("events.tags.key", "tags.key", "tags.key", "tags.key", "tags.key")
    TAGS_VALUE = Column("events.tags.value", "tags.value", "tags.value", "tags.value", "tags.value")
    TAGS_KEYS = Column("events.tags_key", "tags_key", "tags_key", "tags_key", "tags_key")
    TAGS_VALUES = Column(
        "events.tags_value", "tags_value", "tags_value", "tags_value", "tags_value"
    )
    TRANSACTION = Column(
        "events.transaction", "transaction", "transaction_name", "transaction", "transaction"
    )
    USER = Column("events.tags[sentry:user]", "tags[sentry:user]", "user", "user", "user")
    USER_ID = Column("events.user_id", "user_id", "user_id", "user_id", "user.id")
    USER_EMAIL = Column("events.email", "email", "user_email", "email", "user.email")
    USER_USERNAME = Column("events.username", "username", "user_name", "username", "user.username")
    USER_IP_ADDRESS = Column(
        "events.ip_address", "ip_address", "ip_address_v4", "ip_address", "user.ip"
    )
    SDK_NAME = Column("events.sdk_name", "sdk_name", None, "sdk_name", "sdk.name")
    SDK_VERSION = Column("events.sdk_version", "sdk_version", None, "sdk_version", "sdk.version")
    HTTP_METHOD = Column("events.http_method", "http_method", None, "http_method", "http.method")
    HTTP_REFERER = Column("events.http_referer", "http_referer", None, "http_referer", "http.url")
    OS_BUILD = Column("events.os_build", "os_build", None, "os_build", "os.build")
    OS_KERNEL_VERSION = Column(
        "events.os_kernel_version",
        "os_kernel_version",
        None,
        "os_kernel_version",
        "os.kernel_version",
    )
    DEVICE_NAME = Column("events.device_name", "device_name", None, "device_name", "device.name")
    DEVICE_BRAND = Column(
        "events.device_brand", "device_brand", None, "device_brand", "device.brand"
    )
    DEVICE_LOCALE = Column(
        "events.device_locale", "device_locale", None, "device_locale", "device.locale"
    )
    DEVICE_UUID = Column("events.device_uuid", "device_uuid", None, "device_uuid", "device.uuid")
    DEVICE_ARCH = Column("events.device_arch", "device_arch", None, "device_arch", "device.arch")
    DEVICE_BATTERY_LEVEL = Column(
        "events.device_battery_level",
        "device_battery_level",
        None,
        "device_battery_level",
        "device.battery_level",
    )
    DEVICE_ORIENTATION = Column(
        "events.device_orientation",
        "device_orientation",
        None,
        "device_orientation",
        "device.orientation",
    )
    DEVICE_SIMULATOR = Column(
        "events.device_simulator", "device_simulator", None, "device_simulator", "device.simulator"
    )
    DEVICE_ONLINE = Column(
        "events.device_online", "device_online", None, "device_online", "device.online"
    )
    DEVICE_CHARGING = Column(
        "events.device_charging", "device_charging", None, "device_charging", "device.charging"
    )
    GEO_COUNTRY_CODE = Column(
        "events.geo_country_code",
        "geo_country_code",
        "contexts[geo.country_code]",
        "geo_country_code",
        "geo.country_code",
    )
    GEO_REGION = Column(
        "events.geo_region", "geo_region", "contexts[geo.region]", "geo_region", "geo.region"
    )
    GEO_CITY = Column("events.geo_city", "geo_city", "contexts[geo.city]", "geo_city", "geo.city")
    ERROR_TYPE = Column(
        "events.exception_stacks.type",
        "exception_stacks.type",
        None,
        "exception_stacks.type",
        "error.type",
    )
    ERROR_VALUE = Column(
        "events.exception_stacks.value",
        "exception_stacks.value",
        None,
        "exception_stacks.value",
        "error.value",
    )
    ERROR_MECHANISM = Column(
        "events.exception_stacks.mechanism_type",
        "exception_stacks.mechanism_type",
        None,
        "exception_stacks.mechanism_type",
        "error.mechanism",
    )
    ERROR_HANDLED = Column(
        "events.exception_stacks.mechanism_handled",
        "exception_stacks.mechanism_handled",
        None,
        "exception_stacks.mechanism_handled",
        "error.handled",
    )
    STACK_ABS_PATH = Column(
        "events.exception_frames.abs_path",
        "exception_frames.abs_path",
        None,
        "exception_frames.abs_path",
        "stack.abs_path",
    )
    STACK_FILENAME = Column(
        "events.exception_frames.filename",
        "exception_frames.filename",
        None,
        "exception_frames.filename",
        "stack.filename",
    )
    STACK_PACKAGE = Column(
        "events.exception_frames.package",
        "exception_frames.package",
        None,
        "exception_frames.package",
        "stack.package",
    )
    STACK_MODULE = Column(
        "events.exception_frames.module",
        "exception_frames.module",
        None,
        "exception_frames.module",
        "stack.module",
    )
    STACK_FUNCTION = Column(
        "events.exception_frames.function",
        "exception_frames.function",
        None,
        "exception_frames.function",
        "stack.function",
    )
    STACK_IN_APP = Column(
        "events.exception_frames.in_app",
        "exception_frames.in_app",
        None,
        "exception_frames.in_app",
        "stack.in_app",
    )
    STACK_COLNO = Column(
        "events.exception_frames.colno",
        "exception_frames.colno",
        None,
        "exception_frames.colno",
        "stack.colno",
    )
    STACK_LINENO = Column(
        "events.exception_frames.lineno",
        "exception_frames.lineno",
        None,
        "exception_frames.lineno",
        "stack.lineno",
    )
    STACK_STACK_LEVEL = Column(
        "events.exception_frames.stack_level",
        "exception_frames.stack_level",
        None,
        "exception_frames.stack_level",
        "stack.stack_level",
    )
    CONTEXTS_KEY = Column(
        "events.contexts.key", "contexts.key", "contexts.key", "contexts.key", "contexts.key"
    )
    CONTEXTS_VALUE = Column(
        "events.contexts.value",
        "contexts.value",
        "contexts.value",
        "contexts.value",
        "contexts.value",
    )
    # Transactions specific columns
    TRANSACTION_OP = Column(None, None, "transaction_op", "transaction_op", "transaction.op")
    TRANSACTION_DURATION = Column(None, None, "duration", "duration", "transaction.duration")
    TRANSACTION_STATUS = Column(
        None, None, "transaction_status", "transaction_status", "transaction.status"
    )
    # Tracing context fields.
    TRACE_ID = Column(
        "events.contexts[trace.trace_id]",
        "contexts[trace.trace_id]",
        "trace_id",
        "trace_id",
        "trace",
    )
    SPAN_ID = Column(
        "events.contexts[trace.span_id]",
        "contexts[trace.span_id]",
        "span_id",
        "span_id",
        "trace.span",
    )
    PARENT_SPAN_ID = Column(
        None,
        None,
        "contexts[trace.parent_span_id]",
        "contexts[trace.parent_span_id]",
        "trace.parent_span",
    )
