from collections import namedtuple
from enum import Enum

Column = namedtuple("Column", "group_name event_name transaction_name discover_name alias")


class Columns(Enum):
    """
    Value is a tuple of (internal Events name, internal Transaction name, internal
    Discover name, external alias)
    None means the column is not available in that dataset.
    Always use keyword arguments to declare columns for legibility.
    """

    EVENT_ID = Column(
        group_name="events.event_id",
        event_name="event_id",
        transaction_name="event_id",
        discover_name="event_id",
        alias="id",
    )
    GROUP_ID = Column(
        group_name="events.group_id",
        event_name="group_id",
        transaction_name=None,
        discover_name="group_id",
        alias="issue.id",
    )
    # This is needed to query transactions by group id
    # in the Issue Details page. This will not be
    # exposed to users through discover search.
    GROUP_IDS = Column(
        group_name=None,
        event_name="group_ids",
        transaction_name="group_ids",
        discover_name="group_ids",
        alias="performance.issue_ids",
    )
    PROJECT_ID = Column(
        group_name="events.project_id",
        event_name="project_id",
        transaction_name="project_id",
        discover_name="project_id",
        alias="project.id",
    )
    TIMESTAMP = Column(
        group_name="events.timestamp",
        event_name="timestamp",
        transaction_name="finish_ts",
        discover_name="timestamp",
        alias="timestamp",
    )
    TIME = Column(
        group_name="events.time",
        event_name="time",
        transaction_name="bucketed_end",
        discover_name="time",
        alias="time",
    )
    CULPRIT = Column(
        group_name="events.culprit",
        event_name="culprit",
        transaction_name=None,
        discover_name="culprit",
        alias="culprit",
    )
    LOCATION = Column(
        group_name="events.location",
        event_name="location",
        transaction_name=None,
        discover_name="location",
        alias="location",
    )
    MESSAGE = Column(
        group_name="events.message",
        event_name="message",
        transaction_name="transaction_name",
        discover_name="message",
        alias="message",
    )
    PLATFORM = Column(
        group_name="events.platform",
        event_name="platform",
        transaction_name="platform",
        discover_name="platform",
        alias="platform.name",
    )
    ENVIRONMENT = Column(
        group_name="events.environment",
        event_name="environment",
        transaction_name="environment",
        discover_name="environment",
        alias="environment",
    )
    RELEASE = Column(
        group_name="events.tags[sentry:release]",
        event_name="tags[sentry:release]",
        transaction_name="release",
        discover_name="release",
        alias="release",
    )
    DIST = Column(
        group_name="events.tags[sentry:dist]",
        event_name="tags[sentry:dist]",
        transaction_name="dist",
        discover_name="dist",
        alias="dist",
    )
    TITLE = Column(
        group_name="events.title",
        event_name="title",
        transaction_name="transaction_name",
        discover_name="title",
        alias="title",
    )
    TYPE = Column(
        group_name="events.type",
        event_name="type",
        transaction_name=None,
        discover_name="type",
        alias="event.type",
    )
    TAGS_KEY = Column(
        group_name="events.tags.key",
        event_name="tags.key",
        transaction_name="tags.key",
        discover_name="tags.key",
        alias="tags.key",
    )
    TAGS_VALUE = Column(
        group_name="events.tags.value",
        event_name="tags.value",
        transaction_name="tags.value",
        discover_name="tags.value",
        alias="tags.value",
    )
    TAGS_KEYS = Column(
        group_name="events.tags_key",
        event_name="tags_key",
        transaction_name="tags_key",
        discover_name="tags_key",
        alias="tags_key",
    )
    TAGS_VALUES = Column(
        group_name="events.tags_value",
        event_name="tags_value",
        transaction_name="tags_value",
        discover_name="tags_value",
        alias="tags_value",
    )
    TRANSACTION = Column(
        group_name="events.transaction",
        event_name="transaction",
        transaction_name="transaction_name",
        discover_name="transaction",
        alias="transaction",
    )
    USER = Column(
        group_name="events.tags[sentry:user]",
        event_name="tags[sentry:user]",
        transaction_name="user",
        discover_name="user",
        alias="user",
    )
    USER_ID = Column(
        group_name="events.user_id",
        event_name="user_id",
        transaction_name="user_id",
        discover_name="user_id",
        alias="user.id",
    )
    USER_EMAIL = Column(
        group_name="events.email",
        event_name="email",
        transaction_name="user_email",
        discover_name="email",
        alias="user.email",
    )
    USER_USERNAME = Column(
        group_name="events.username",
        event_name="username",
        transaction_name="user_name",
        discover_name="username",
        alias="user.username",
    )
    USER_IP_ADDRESS = Column(
        group_name="events.ip_address",
        event_name="ip_address",
        transaction_name="ip_address",
        discover_name="ip_address",
        alias="user.ip",
    )
    USER_DISPLAY = Column(
        group_name=None,
        event_name=None,
        transaction_name=None,
        discover_name="user.display",
        alias="user.display",
    )
    SDK_NAME = Column(
        group_name="events.sdk_name",
        event_name="sdk_name",
        transaction_name="sdk_name",
        discover_name="sdk_name",
        alias="sdk.name",
    )
    SDK_VERSION = Column(
        group_name="events.sdk_version",
        event_name="sdk_version",
        transaction_name="sdk_version",
        discover_name="sdk_version",
        alias="sdk.version",
    )

    HTTP_METHOD = Column(
        group_name="events.http_method",
        event_name="http_method",
        transaction_name="http_method",
        discover_name="http_method",
        alias="http.method",
    )
    HTTP_REFERER = Column(
        group_name="events.http_referer",
        event_name="http_referer",
        transaction_name="http_referer",
        discover_name="http_referer",
        alias="http.referer",
    )
    HTTP_URL = Column(
        group_name="events.tags[url]",
        event_name="tags[url]",
        transaction_name="tags[url]",
        discover_name="tags[url]",
        alias="http.url",
    )
    HTTP_STATUS_CODE = Column(
        group_name="events.contexts[response.status_code]",
        event_name="contexts[response.status_code]",
        transaction_name="contexts[response.status_code]",
        discover_name="contexts[response.status_code]",
        alias="http.status_code",
    )
    OS_BUILD = Column(
        group_name="events.contexts[os.build]",
        event_name="contexts[os.build]",
        transaction_name="contexts[os.build]",
        discover_name="contexts[os.build]",
        alias="os.build",
    )
    OS_KERNEL_VERSION = Column(
        group_name="events.contexts[os.kernel_version]",
        event_name="contexts[os.kernel_version]",
        transaction_name="contexts[os.kernel_version]",
        discover_name="contexts[os.kernel_version]",
        alias="os.kernel_version",
    )
    DEVICE_ARCH = Column(
        group_name="events.contexts[device.arch]",
        event_name="contexts[device.arch]",
        transaction_name="contexts[device.arch]",
        discover_name="contexts[device.arch]",
        alias="device.arch",
    )
    DEVICE_BATTERY_LEVEL = Column(
        group_name="events.contexts[device.battery_level]",
        event_name="contexts[device.battery_level]",
        transaction_name="contexts[device.battery_level]",
        discover_name="contexts[device.battery_level]",
        alias="device.battery_level",
    )
    DEVICE_BRAND = Column(
        group_name="events.contexts[device.brand]",
        event_name="contexts[device.brand]",
        transaction_name="contexts[device.brand]",
        discover_name="contexts[device.brand]",
        alias="device.brand",
    )
    DEVICE_CHARGING = Column(
        group_name="events.contexts[device.charging]",
        event_name="contexts[device.charging]",
        transaction_name="contexts[device.charging]",
        discover_name="contexts[device.charging]",
        alias="device.charging",
    )
    DEVICE_LOCALE = Column(
        group_name="events.contexts[device.locale]",
        event_name="contexts[device.locale]",
        transaction_name="contexts[device.locale]",
        discover_name="contexts[device.locale]",
        alias="device.locale",
    )
    DEVICE_MODEL_ID = Column(
        group_name="events.contexts[device.model_id]",
        event_name="contexts[device.model_id]",
        transaction_name="contexts[device.model_id]",
        discover_name="contexts[device.model_id]",
        alias="device.model_id",
    )
    DEVICE_NAME = Column(
        group_name="events.contexts[device.name]",
        event_name="contexts[device.name]",
        transaction_name="contexts[device.name]",
        discover_name="contexts[device.name]",
        alias="device.name",
    )
    DEVICE_ONLINE = Column(
        group_name="events.contexts[device.online]",
        event_name="contexts[device.online]",
        transaction_name="contexts[device.online]",
        discover_name="contexts[device.online]",
        alias="device.online",
    )
    DEVICE_ORIENTATION = Column(
        group_name="events.contexts[device.orientation]",
        event_name="contexts[device.orientation]",
        transaction_name="contexts[device.orientation]",
        discover_name="contexts[device.orientation]",
        alias="device.orientation",
    )
    DEVICE_SIMULATOR = Column(
        group_name="events.contexts[device.simulator]",
        event_name="contexts[device.simulator]",
        transaction_name="contexts[device.simulator]",
        discover_name="contexts[device.simulator]",
        alias="device.simulator",
    )
    DEVICE_UUID = Column(
        group_name="events.contexts[device.uuid]",
        event_name="contexts[device.uuid]",
        transaction_name="contexts[device.uuid]",
        discover_name="contexts[device.uuid]",
        alias="device.uuid",
    )
    GEO_COUNTRY_CODE = Column(
        group_name="events.geo_country_code",
        event_name="geo_country_code",
        transaction_name="contexts[geo.country_code]",
        discover_name="geo_country_code",
        alias="geo.country_code",
    )
    GEO_REGION = Column(
        group_name="events.geo_region",
        event_name="geo_region",
        transaction_name="contexts[geo.region]",
        discover_name="geo_region",
        alias="geo.region",
    )
    GEO_CITY = Column(
        group_name="events.geo_city",
        event_name="geo_city",
        transaction_name="contexts[geo.city]",
        discover_name="geo_city",
        alias="geo.city",
    )
    ERROR_TYPE = Column(
        group_name="events.exception_stacks.type",
        event_name="exception_stacks.type",
        transaction_name=None,
        discover_name="exception_stacks.type",
        alias="error.type",
    )
    ERROR_VALUE = Column(
        group_name="events.exception_stacks.value",
        event_name="exception_stacks.value",
        transaction_name=None,
        discover_name="exception_stacks.value",
        alias="error.value",
    )
    ERROR_MECHANISM = Column(
        group_name="events.exception_stacks.mechanism_type",
        event_name="exception_stacks.mechanism_type",
        transaction_name=None,
        discover_name="exception_stacks.mechanism_type",
        alias="error.mechanism",
    )
    ERROR_HANDLED = Column(
        group_name="events.exception_stacks.mechanism_handled",
        event_name="exception_stacks.mechanism_handled",
        transaction_name=None,
        discover_name="exception_stacks.mechanism_handled",
        alias="error.handled",
    )
    ERROR_RECEIVED = Column(
        group_name=None,
        event_name="received",
        transaction_name=None,
        discover_name="received",
        alias="error.received",
    )
    STACK_ABS_PATH = Column(
        group_name="events.exception_frames.abs_path",
        event_name="exception_frames.abs_path",
        transaction_name=None,
        discover_name="exception_frames.abs_path",
        alias="stack.abs_path",
    )
    STACK_FILENAME = Column(
        group_name="events.exception_frames.filename",
        event_name="exception_frames.filename",
        transaction_name=None,
        discover_name="exception_frames.filename",
        alias="stack.filename",
    )
    STACK_PACKAGE = Column(
        group_name="events.exception_frames.package",
        event_name="exception_frames.package",
        transaction_name=None,
        discover_name="exception_frames.package",
        alias="stack.package",
    )
    STACK_MODULE = Column(
        group_name="events.exception_frames.module",
        event_name="exception_frames.module",
        transaction_name=None,
        discover_name="exception_frames.module",
        alias="stack.module",
    )
    STACK_FUNCTION = Column(
        group_name="events.exception_frames.function",
        event_name="exception_frames.function",
        transaction_name=None,
        discover_name="exception_frames.function",
        alias="stack.function",
    )
    STACK_IN_APP = Column(
        group_name="events.exception_frames.in_app",
        event_name="exception_frames.in_app",
        transaction_name=None,
        discover_name="exception_frames.in_app",
        alias="stack.in_app",
    )
    STACK_COLNO = Column(
        group_name="events.exception_frames.colno",
        event_name="exception_frames.colno",
        transaction_name=None,
        discover_name="exception_frames.colno",
        alias="stack.colno",
    )
    STACK_LINENO = Column(
        group_name="events.exception_frames.lineno",
        event_name="exception_frames.lineno",
        transaction_name=None,
        discover_name="exception_frames.lineno",
        alias="stack.lineno",
    )
    STACK_STACK_LEVEL = Column(
        group_name="events.exception_frames.stack_level",
        event_name="exception_frames.stack_level",
        transaction_name=None,
        discover_name="exception_frames.stack_level",
        alias="stack.stack_level",
    )
    CONTEXTS_KEY = Column(
        group_name="events.contexts.key",
        event_name="contexts.key",
        transaction_name="contexts.key",
        discover_name=None,
        alias="contexts.key",
    )
    CONTEXTS_VALUE = Column(
        group_name="events.contexts.value",
        event_name="contexts.value",
        transaction_name="contexts.value",
        discover_name=None,
        alias="contexts.value",
    )
    # Transactions specific columns
    TRANSACTION_OP = Column(
        group_name=None,
        event_name=None,
        transaction_name="transaction_op",
        discover_name="transaction_op",
        alias="transaction.op",
    )
    TRANSACTION_DURATION = Column(
        group_name=None,
        event_name=None,
        transaction_name="duration",
        discover_name="duration",
        alias="transaction.duration",
    )
    TRANSACTION_STATUS = Column(
        group_name=None,
        event_name=None,
        transaction_name="transaction_status",
        discover_name="transaction_status",
        alias="transaction.status",
    )
    TRANSACTION_SOURCE = Column(
        group_name=None,
        event_name=None,
        transaction_name="transaction_source",
        discover_name="transaction_source",
        alias="transaction.source",
    )
    MEASUREMENTS_KEYS = Column(
        group_name=None,
        event_name=None,
        transaction_name="measurements.key",
        discover_name="measurements.key",
        alias="measurements_key",
    )
    MEASUREMENTS_VALUES = Column(
        group_name=None,
        event_name=None,
        transaction_name="measurements.value",
        discover_name="measurements.value",
        alias="measurements_value",
    )
    SPAN_OP_BREAKDOWNS_KEYS = Column(
        group_name=None,
        event_name=None,
        transaction_name="span_op_breakdowns.key",
        discover_name="span_op_breakdowns.key",
        alias="span_op_breakdowns_key",
    )
    SPAN_OP_BREAKDOWNS_VALUES = Column(
        group_name=None,
        event_name=None,
        transaction_name="span_op_breakdowns.value",
        discover_name="span_op_breakdowns.value",
        alias="span_op_breakdowns_value",
    )
    SPANS_OP = Column(
        group_name=None,
        event_name=None,
        transaction_name="spans.op",
        discover_name="spans.op",
        alias="spans_op",
    )
    SPANS_GROUP = Column(
        group_name=None,
        event_name=None,
        transaction_name="spans.group",
        discover_name="spans.group",
        alias="spans_group",
    )
    SPANS_EXCLUSIVE_TIME = Column(
        group_name=None,
        event_name=None,
        transaction_name="spans.exclusive_time",
        discover_name="spans.exclusive_time",
        alias="spans_exclusive_time",
    )
    # Tracing context fields.
    TRACE_ID = Column(
        group_name="events.contexts[trace.trace_id]",
        event_name="contexts[trace.trace_id]",
        transaction_name="trace_id",
        discover_name="contexts[trace.trace_id]",
        alias="trace",
    )
    SPAN_ID = Column(
        group_name="events.contexts[trace.span_id]",
        event_name="contexts[trace.span_id]",
        transaction_name="span_id",
        discover_name="span_id",
        alias="trace.span",
    )
    PARENT_SPAN_ID = Column(
        group_name=None,
        event_name=None,
        transaction_name="contexts[trace.parent_span_id]",
        discover_name="contexts[trace.parent_span_id]",
        alias="trace.parent_span",
    )

    # Reprocessing context
    REPROCESSING_ORIGINAL_GROUP_ID = Column(
        group_name="events.contexts[reprocessing.original_issue_id]",
        event_name="contexts[reprocessing.original_issue_id]",
        transaction_name="contexts[reprocessing.original_issue_id]",
        discover_name="contexts[reprocessing.original_issue_id]",
        alias="reprocessing.original_issue_id",
    )
    TRACE_SAMPLE_RATE = Column(
        group_name="events.contexts[trace.client_sample_rate]",
        event_name="contexts[trace.client_sample_rate]",
        transaction_name="contexts[trace.client_sample_rate]",
        discover_name="contexts[trace.client_sample_rate]",
        alias="trace.client_sample_rate",
    )

    APP_START_TYPE = Column(
        group_name=None,
        event_name=None,
        transaction_name="app_start_type",
        discover_name="app_start_type",
        alias="app_start_type",
    )
