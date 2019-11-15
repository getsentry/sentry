from __future__ import absolute_import

from enum import Enum
from collections import namedtuple

Column = namedtuple("Column", "event_name transaction_name discover_name alias")


class Columns(Enum):
    """
    Value is a tuple of (internal Events name, internal Transaction name, internal
    Discover name, external alias)
    None means the column is not available in that dataset.
    """

    EVENT_ID = Column("event_id", "event_id", "event_id", "id")
    GROUP_ID = Column("group_id", None, "group_id", "issue.id")
    ISSUE = Column("issue", None, "group_id", "issue.id")
    PROJECT_ID = Column("project_id", "project_id", "project_id", "project.id")
    TIMESTAMP = Column("timestamp", "finish_ts", "timestamp", "timestamp")
    TIME = Column("time", "bucketed_end", "time", "time")
    CULPRIT = Column("culprit", None, "culprit", "culprit")
    LOCATION = Column("location", None, "location", "location")
    MESSAGE = Column("message", "transaction_name", "message", "message")
    PLATFORM = Column("platform", "platform", "platform", "platform.name")
    ENVIRONMENT = Column("environment", "environment", "environment", "environment")
    RELEASE = Column("tags[sentry:release]", "release", "sentry:release", "release")
    TITLE = Column("title", "transaction_name", "title", "title")
    TYPE = Column("type", None, "type", "event.type")
    TAGS_KEY = Column("tags.key", "tags.key", "tags.key", "tags.key")
    TAGS_VALUE = Column("tags.value", "tags.value", "tags.value", "tags.value")
    TAGS_KEYS = Column("tags_key", "tags_key", "tags_key", "tags_key")
    TAGS_VALUES = Column("tags_value", "tags_value", "tags_value", "tags_value")
    TRANSACTION = Column("transaction", "transaction_name", "transaction", "transaction")
    USER = Column("tags[sentry:user]", "user", "user", "user")
    USER_ID = Column("user_id", "user_id", "user_id", "user.id")
    USER_EMAIL = Column("email", "user_email", "email", "user.email")
    USER_USERNAME = Column("username", "user_name", "username", "user.username")
    USER_IP_ADDRESS = Column("ip_address", "ip_address_v4", "ip_address", "user.ip")
    SDK_NAME = Column("sdk_name", None, "sdk_name", "sdk.name")
    SDK_VERSION = Column("sdk_version", None, "sdk_version", "sdk.version")
    HTTP_METHOD = Column("http_method", None, "http_method", "http.method")
    HTTP_REFERER = Column("http_referer", None, "http_referer", "http.url")
    OS_BUILD = Column("os_build", None, "os_build", "os.build")
    OS_KERNEL_VERSION = Column("os_kernel_version", None, "os_kernel_version", "os.kernel_version")
    DEVICE_NAME = Column("device_name", None, "device_name", "device.name")
    DEVICE_BRAND = Column("device_brand", None, "device_brand", "device.brand")
    DEVICE_LOCALE = Column("device_locale", None, "device_locale", "device.locale")
    DEVICE_UUID = Column("device_uuid", None, "device_uuid", "device.uuid")
    DEVICE_ARCH = Column("device_arch", None, "device_arch", "device.arch")
    DEVICE_BATTERY_LEVEL = Column(
        "device_battery_level", None, "device_battery_level", "device.battery_level"
    )
    DEVICE_ORIENTATION = Column(
        "device_orientation", None, "device_orientation", "device.orientation"
    )
    DEVICE_SIMULATOR = Column("device_simulator", None, "device_simulator", "device.simulator")
    DEVICE_ONLINE = Column("device_online", None, "device_online", "device.online")
    DEVICE_CHARGING = Column("device_charging", None, "device_charging", "device.charging")
    GEO_COUNTRY_CODE = Column("geo_country_code", None, "geo_country_code", "geo.country_code")
    GEO_REGION = Column("geo_region", None, "geo_region", "geo.region")
    GEO_CITY = Column("geo_city", None, "geo_city", "geo.city")
    ERROR_TYPE = Column("exception_stacks.type", None, "exception_stacks.type", "error.type")
    ERROR_VALUE = Column("exception_stacks.value", None, "exception_stacks.value", "error.value")
    ERROR_MECHANISM = Column(
        "exception_stacks.mechanism_type",
        None,
        "exception_stacks.mechanism_type",
        "error.mechanism",
    )
    ERROR_HANDLED = Column(
        "exception_stacks.mechanism_handled",
        None,
        "exception_stacks.mechanism_handled",
        "error.handled",
    )
    STACK_ABS_PATH = Column(
        "exception_frames.abs_path", None, "exception_frames.abs_path", "stack.abs_path"
    )
    STACK_FILENAME = Column(
        "exception_frames.filename", None, "exception_frames.filename", "stack.filename"
    )
    STACK_PACKAGE = Column(
        "exception_frames.package", None, "exception_frames.package", "stack.package"
    )
    STACK_MODULE = Column(
        "exception_frames.module", None, "exception_frames.module", "stack.module"
    )
    STACK_FUNCTION = Column(
        "exception_frames.function", None, "exception_frames.function", "stack.function"
    )
    STACK_IN_APP = Column(
        "exception_frames.in_app", None, "exception_frames.in_app", "stack.in_app"
    )
    STACK_COLNO = Column("exception_frames.colno", None, "exception_frames.colno", "stack.colno")
    STACK_LINENO = Column(
        "exception_frames.lineno", None, "exception_frames.lineno", "stack.lineno"
    )
    STACK_STACK_LEVEL = Column(
        "exception_frames.stack_level", None, "exception_frames.stack_level", "stack.stack_level"
    )
    CONTEXTS_KEY = Column("contexts.key", "contexts.key", "contexts.key", "contexts.key")
    CONTEXTS_VALUE = Column("contexts.value", "contexts.value", "contexts.value", "contexts.value")
    # Transactions specific columns
    TRANSACTION_OP = Column(None, "transaction_op", "transaction_op", "transaction.op")
    TRANSACTION_DURATION = Column(None, "duration", "duration", "transaction.duration")


def get_columns_from_aliases(aliases):
    """
    Resolve a list of aliases to the columns
    """
    columns = set()
    for alias in aliases:
        for _i, col in enumerate(Columns):
            if col.value.alias == alias:
                columns.add(col)
                continue
            # Handle as a tag if its not on the list
            columns.add(Columns.TAGS_KEY)
            columns.add(Columns.TAGS_VALUE)

    return list(columns)
