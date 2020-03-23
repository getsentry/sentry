from __future__ import absolute_import

from enum import Enum
from collections import namedtuple

Column = namedtuple("Column", "group_name event_name discover_name alias")


class Columns(Enum):
    """
    Value is a tuple of (internal Events name, internal Transaction name, internal
    Discover name, external alias)
    None means the column is not available in that dataset.
    """

    EVENT_ID = Column("events.event_id", "event_id", "event_id", "id")
    GROUP_ID = Column("events.group_id", "group_id", "group_id", "issue.id")
    PROJECT_ID = Column("events.project_id", "project_id", "project_id", "project.id")
    TIMESTAMP = Column("events.timestamp", "timestamp", "timestamp", "timestamp")
    TIME = Column("events.time", "time", "time", "time")
    CULPRIT = Column("events.culprit", "culprit", "culprit", "culprit")
    LOCATION = Column("events.location", "location", "location", "location")
    MESSAGE = Column("events.message", "message", "message", "message")
    PLATFORM = Column("events.platform", "platform", "platform", "platform.name")
    ENVIRONMENT = Column("events.environment", "environment", "environment", "environment")
    RELEASE = Column("events.tags[sentry:release]", "tags[sentry:release]", "release", "release")
    DIST = Column("events.tags[sentry:dist]", "tags[sentry:dist]", "dist", "dist")
    TITLE = Column("events.title", "title", "title", "title")
    TYPE = Column("events.type", "type", "type", "event.type")
    TAGS_KEY = Column("events.tags.key", "tags.key", "tags.key", "tags.key")
    TAGS_VALUE = Column("events.tags.value", "tags.value", "tags.value", "tags.value")
    TAGS_KEYS = Column("events.tags_key", "tags_key", None, "tags_key")
    TAGS_VALUES = Column("events.tags_value", "tags_value", None, "tags_value")
    TRANSACTION = Column("events.transaction", "transaction", "transaction", "transaction")
    USER = Column("events.tags[sentry:user]", "tags[sentry:user]", "user", "user")
    USER_ID = Column("events.user_id", "user_id", "user_id", "user.id")
    USER_EMAIL = Column("events.email", "email", "email", "user.email")
    USER_USERNAME = Column("events.username", "username", "username", "user.username")
    USER_IP_ADDRESS = Column("events.ip_address", "ip_address", "ip_address", "user.ip")
    SDK_NAME = Column("events.sdk_name", "sdk_name", "sdk_name", "sdk.name")
    SDK_VERSION = Column("events.sdk_version", "sdk_version", "sdk_version", "sdk.version")
    HTTP_METHOD = Column(
        "events.contexts[http.method]",
        "contexts[http.method]",
        "contexts[http.method]",
        "http.method",
    )
    HTTP_REFERER = Column(
        "events.contexts[http.referer]",
        "contexts[http.referer]",
        "contexts[http.referer]",
        "http.referer",
    )
    HTTP_URL = Column(
        "events.contexts[http.url]", "contexts[http.url]", "contexts[http.url]", "http.url"
    )
    OS_BUILD = Column(
        "events.contexts[os.build]", "contexts[os.build]", "contexts[os.build]", "os.build"
    )
    OS_KERNEL_VERSION = Column(
        "events.contexts[os.kernel_version]",
        "contexts[os.kernel_version]",
        "contexts[os.kernel_version]",
        "os.kernel_version",
    )
    DEVICE_ARCH = Column(
        "events.contexts[device.arch]",
        "contexts[device.arch]",
        "contexts[device.arch]",
        "device.arch",
    )
    DEVICE_BATTERY_LEVEL = Column(
        "events.contexts[device.battery_level]",
        "contexts[device.battery_level]",
        "contexts[device.battery_level]",
        "device.battery_level",
    )
    DEVICE_BRAND = Column(
        "events.contexts[device.brand]",
        "contexts[device.brand]",
        "contexts[device.brand]",
        "device.brand",
    )
    DEVICE_CHARGING = Column(
        "events.contexts[device.charging]",
        "contexts[device.charging]",
        "contexts[device.charging]",
        "device.charging",
    )
    DEVICE_LOCALE = Column(
        "events.contexts[device.locale]",
        "contexts[device.locale]",
        "contexts[device.locale]",
        "device.locale",
    )
    DEVICE_MODEL_ID = Column(
        "events.contexts[device.model_id]",
        "contexts[device.model_id]",
        "contexts[device.model_id]",
        "device.model_id",
    )
    DEVICE_NAME = Column(
        "events.contexts[device.name]",
        "contexts[device.name]",
        "contexts[device.name]",
        "device.name",
    )
    DEVICE_ONLINE = Column(
        "events.contexts[device.online]",
        "contexts[device.online]",
        "contexts[device.online]",
        "device.online",
    )
    DEVICE_ORIENTATION = Column(
        "events.contexts[device.orientation]",
        "contexts[device.orientation]",
        "contexts[device.orientation]",
        "device.orientation",
    )
    DEVICE_SIMULATOR = Column(
        "events.contexts[device.simulator]",
        "contexts[device.simulator]",
        "contexts[device.simulator]",
        "device.simulator",
    )
    DEVICE_UUID = Column(
        "events.contexts[device.uuid]",
        "contexts[device.uuid]",
        "contexts[device.uuid]",
        "device.uuid",
    )
    GEO_COUNTRY_CODE = Column(
        "events.geo_country_code", "geo_country_code", "geo_country_code", "geo.country_code"
    )
    GEO_REGION = Column("events.geo_region", "geo_region", "geo_region", "geo.region")
    GEO_CITY = Column("events.geo_city", "geo_city", "geo_city", "geo.city")
    ERROR_TYPE = Column(
        "events.exception_stacks.type",
        "exception_stacks.type",
        "exception_stacks.type",
        "error.type",
    )
    ERROR_VALUE = Column(
        "events.exception_stacks.value",
        "exception_stacks.value",
        "exception_stacks.value",
        "error.value",
    )
    ERROR_MECHANISM = Column(
        "events.exception_stacks.mechanism_type",
        "exception_stacks.mechanism_type",
        "exception_stacks.mechanism_type",
        "error.mechanism",
    )
    ERROR_HANDLED = Column(
        "events.exception_stacks.mechanism_handled",
        "exception_stacks.mechanism_handled",
        "exception_stacks.mechanism_handled",
        "error.handled",
    )
    STACK_ABS_PATH = Column(
        "events.exception_frames.abs_path",
        "exception_frames.abs_path",
        "exception_frames.abs_path",
        "stack.abs_path",
    )
    STACK_FILENAME = Column(
        "events.exception_frames.filename",
        "exception_frames.filename",
        "exception_frames.filename",
        "stack.filename",
    )
    STACK_PACKAGE = Column(
        "events.exception_frames.package",
        "exception_frames.package",
        "exception_frames.package",
        "stack.package",
    )
    STACK_MODULE = Column(
        "events.exception_frames.module",
        "exception_frames.module",
        "exception_frames.module",
        "stack.module",
    )
    STACK_FUNCTION = Column(
        "events.exception_frames.function",
        "exception_frames.function",
        "exception_frames.function",
        "stack.function",
    )
    STACK_IN_APP = Column(
        "events.exception_frames.in_app",
        "exception_frames.in_app",
        "exception_frames.in_app",
        "stack.in_app",
    )
    STACK_COLNO = Column(
        "events.exception_frames.colno",
        "exception_frames.colno",
        "exception_frames.colno",
        "stack.colno",
    )
    STACK_LINENO = Column(
        "events.exception_frames.lineno",
        "exception_frames.lineno",
        "exception_frames.lineno",
        "stack.lineno",
    )
    STACK_STACK_LEVEL = Column(
        "events.exception_frames.stack_level",
        "exception_frames.stack_level",
        "exception_frames.stack_level",
        "stack.stack_level",
    )
    CONTEXTS_KEY = Column("events.contexts.key", "contexts.key", None, "contexts.key")
    CONTEXTS_VALUE = Column("events.contexts.value", "contexts.value", None, "contexts.value")
    # Transactions specific columns
    TRANSACTION_OP = Column(None, None, "transaction_op", "transaction.op")
    TRANSACTION_DURATION = Column(None, None, "duration", "transaction.duration")
    TRANSACTION_STATUS = Column(None, None, "transaction_status", "transaction.status")
    # Tracing context fields.
    TRACE_ID = Column(
        "events.contexts[trace.trace_id]",
        "contexts[trace.trace_id]",
        "contexts[trace.trace_id]",
        "trace",
    )
    SPAN_ID = Column(
        "events.contexts[trace.span_id]",
        "contexts[trace.span_id]",
        "contexts[trace.span_id]",
        "trace.span",
    )
    PARENT_SPAN_ID = Column(None, None, "contexts[trace.parent_span_id]", "trace.parent_span")
