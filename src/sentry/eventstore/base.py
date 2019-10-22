from __future__ import absolute_import

from enum import Enum

from sentry import nodestore
from sentry.utils.services import Service


class Columns(Enum):
    """
    Value is a tuple of (internal Events name, internal Transaction name, external alias)
    None means the column is not available in that dataset.
    """

    EVENT_ID = ("event_id", "event_id", "id")
    GROUP_ID = ("group_id", None, "issue.id")
    # ISSUE = ("issue", None, "issue.id")
    PROJECT_ID = ("project_id", "project_id", "project.id")
    TIMESTAMP = ("timestamp", "finish_ts", "timestamp")
    TIME = ("time", "bucketed_end", "time")
    CULPRIT = ("culprit", None, "culprit")
    LOCATION = ("location", None, "location")
    MESSAGE = ("message", "transaction_name", "message")
    PLATFORM = ("platform", "platform", "platform.name")
    ENVIRONMENT = ("environment", "environment", "environment")
    RELEASE = ("tags[sentry:release]", "release", "release")
    TITLE = ("title", "transaction_name", "title")
    TYPE = ("type", None, "event.type")
    TAGS_KEY = ("tags.key", "tags.key", "tags.key")
    TAGS_VALUE = ("tags.value", "tags.value", "tags.value")
    TRANSACTION = ("transaction", "transaction_name", "transaction")
    USER = ("tags[sentry:user]", "user", "user")
    USER_ID = ("user_id", "user_id", "user.id")
    USER_EMAIL = ("email", "user_email", "user.email")
    USER_USERNAME = ("username", "user_name", "user.username")
    USER_IP_ADDRESS = ("ip_address", "ip_address_v4", "user.ip")
    SDK_NAME = ("sdk_name", None, "sdk.name")
    SDK_VERSION = ("sdk_version", None, "sdk.version")
    HTTP_METHOD = ("http_method", None, "http.method")
    HTTP_REFERER = ("http_referer", None, "http.url")
    OS_BUILD = ("os_build", None, "os.build")
    OS_KERNEL_VERSION = ("os_kernel_version", None, "os.kernel_version")
    DEVICE_NAME = ("device_name", None, "device.name")
    DEVICE_BRAND = ("device_brand", None, "device.brand")
    DEVICE_LOCALE = ("device_locale", None, "device.locale")
    DEVICE_UUID = ("device_uuid", None, "device.uuid")
    DEVICE_ARCH = ("device_arch", None, "device.arch")
    DEVICE_BATTERY_LEVEL = ("device_battery_level", None, "device.battery_level")
    DEVICE_ORIENTATION = ("device_orientation", None, "device.orientation")
    DEVICE_SIMULATOR = ("device_simulator", None, "device.simulator")
    DEVICE_ONLINE = ("device_online", None, "device.online")
    DEVICE_CHARGING = ("device_charging", None, "device.charging")
    GEO_COUNTRY_CODE = ("geo_country_code", None, "geo.country_code")
    GEO_REGION = ("geo_region", None, "geo.region")
    GEO_CITY = ("geo_city", None, "geo.city")
    ERROR_TYPE = ("exception_stacks.type", None, "error.type")
    ERROR_VALUE = ("exception_stacks.value", None, "error.value")
    ERROR_MECHANISM = ("exception_stacks.mechanism_type", None, "error.mechanism")
    ERROR_HANDLED = ("exception_stacks.mechanism_handled", None, "error.handled")
    STACK_ABS_PATH = ("exception_frames.abs_path", None, "stack.abs_path")
    STACK_FILENAME = ("exception_frames.filename", None, "stack.filename")
    STACK_PACKAGE = ("exception_frames.package", None, "stack.package")
    STACK_MODULE = ("exception_frames.module", None, "stack.module")
    STACK_FUNCTION = ("exception_frames.function", None, "stack.function")
    STACK_IN_APP = ("exception_frames.in_app", None, "stack.in_app")
    STACK_COLNO = ("exception_frames.colno", None, "stack.colno")
    STACK_LINENO = ("exception_frames.lineno", None, "stack.lineno")
    STACK_STACK_LEVEL = ("exception_frames.stack_level", None, "stack.stack_level")
    CONTEXTS_KEY = ("contexts.key", "contexts.key", "contexts.key")
    CONTEXTS_VALUE = ("contexts.value", "contexts.value", "contexts.value")
    # Transactions specific columns
    TRANSACTION_TRACE_ID = (None, "trace_id", "trace_id")
    TRANSACTION_SPAN_ID = (None, "span_id", "span_id")
    TRANSACTION_OP = (None, "transaction_op", "transaction.op")
    TRANSACTION_DURATION = (None, "duration", "transaction.duration")


class Filter(object):
    """
    A set of conditions, start/end times and project, group and event ID sets
    used to restrict the results of a Snuba query.

    start (DateTime): Start datetime - default None
    end (DateTime): Start datetime - default None
    conditions (Sequence[Sequence[str, str, Any]]): List of conditions to fetch - default None
    project_ids (Sequence[int]): List of project IDs to fetch - default None
    group_ids (Sequence[int]): List of group IDs to fetch - defualt None
    event_ids (Sequence[int]): List of event IDs to fetch - default None
    """

    def __init__(
        self,
        start=None,
        end=None,
        conditions=None,
        project_ids=None,
        group_ids=None,
        event_ids=None,
    ):
        self.start = start
        self.end = end
        self.conditions = conditions
        self.project_ids = project_ids
        self.group_ids = group_ids
        self.event_ids = event_ids

    @property
    def filter_keys(self):
        """
        Get filter_keys value required for raw snuba query
        """
        filter_keys = {}

        if self.project_ids:
            filter_keys["project_id"] = self.project_ids

        if self.group_ids:
            filter_keys["issue"] = self.group_ids

        if self.event_ids:
            filter_keys["event_id"] = self.event_ids

        return filter_keys


class EventStorage(Service):
    __all__ = (
        "minimal_columns",
        "full_columns",
        "get_event_by_id",
        "get_events",
        "get_prev_event_id",
        "get_next_event_id",
        "get_earliest_event_id",
        "get_latest_event_id",
        "bind_nodes",
    )

    # The minimal list of columns we need to get from snuba to bootstrap an
    # event. If the client is planning on loading the entire event body from
    # nodestore anyway, we may as well only fetch the minimum from snuba to
    # avoid duplicated work.
    minimal_columns = [Columns.EVENT_ID, Columns.GROUP_ID, Columns.PROJECT_ID, Columns.TIMESTAMP]

    # A list of all useful columns we can get from snuba.
    full_columns = minimal_columns + [
        Columns.CULPRIT,
        Columns.LOCATION,
        Columns.MESSAGE,
        Columns.PLATFORM,
        Columns.TITLE,
        Columns.TYPE,
        Columns.TRANSACTION,
        # Required to provide snuba-only tags
        Columns.TAGS_KEY,
        Columns.TAGS_VALUE,
        # Required to provide snuba-only 'user' interface
        Columns.USER_EMAIL,
        Columns.USER_IP_ADDRESS,
        Columns.USER_ID,
        Columns.USER_USERNAME,
    ]

    def get_events(self, filter, additional_columns, orderby, limit, offset, referrer):
        """
        Fetches a list of events given a set of criteria.

        Arguments:
        filter (Filter): Filter
        additional_columns (Sequence[Column]): List of additional columns to fetch - default None
        orderby (Sequence[str]): List of fields to order by - default ['-time', '-event_id']
        limit (int): Query limit - default 100
        offset (int): Query offset - default 0
        referrer (string): Referrer - default "eventstore.get_events"
        """
        raise NotImplementedError

    def get_event_by_id(self, project_id, event_id, additional_columns):
        """
        Gets a single event given a project_id and event_id.

        Arguments:
        project_id (int): Project ID
        event_id (str): Event ID
        additional_columns: (Sequence[Column]) - List of addition columns to fetch - default None
        """
        raise NotImplementedError

    def get_next_event_id(self, event, filter):
        """
        Gets the next event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        filter (Filter): Filter
        """
        raise NotImplementedError

    def get_prev_event_id(self, event, filter):
        """
        Gets the previous event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        filter (Filter): Filter
        """
        raise NotImplementedError

    def get_earliest_event_id(self, event, filter):
        """
        Gets the earliest event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        filter (Filter): Filter
        """
        raise NotImplementedError

    def get_latest_event_id(self, event, filter):
        """
        Gets the latest event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        filter (Filter): Filter
        """
        raise NotImplementedError

    def bind_nodes(self, object_list, node_name="data"):
        """
        For a list of Event objects, and a property name where we might find an
        (unfetched) NodeData on those objects, fetch all the data blobs for
        those NodeDatas with a single multi-get command to nodestore, and bind
        the returned blobs to the NodeDatas
        """
        object_node_list = [
            (i, getattr(i, node_name)) for i in object_list if getattr(i, node_name).id
        ]

        node_ids = [n.id for _, n in object_node_list]
        if not node_ids:
            return

        node_results = nodestore.get_multi(node_ids)

        for item, node in object_node_list:
            data = node_results.get(node.id) or {}
            node.bind_data(data, ref=node.get_ref(item))
