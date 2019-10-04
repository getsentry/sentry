from __future__ import absolute_import

from enum import Enum

from sentry import nodestore
from sentry.utils.services import Service


class Columns(Enum):
    # TODO add all the other columns.
    EVENT_ID = "event_id"
    GROUP_ID = "group_id"
    PROJECT_ID = "project_id"
    TIMESTAMP = "timestamp"
    CULPRIT = "culprit"
    LOCATION = "location"
    MESSAGE = "message"
    PLATFORM = "platform"
    TITLE = "title"
    TYPE = "type"
    TAGS_KEY = "tags.key"
    TAGS_VALUE = "tags.value"
    EMAIL = "email"
    IP_ADDRESS = "ip_address"
    USER_ID = "user_id"
    USERNAME = "username"
    TRANSACTION = "transaction"
    USER_ID = "user_id"
    USER_EMAIL = "email"
    USER_USERNAME = "username"
    USER_IP = "ip_address"
    SDK_NAME = "sdk_name"
    SDK_VERSION = "sdk_version"
    HTTP_METHOD = "http_method"
    HTTP_REFERER = "http_referer"
    HTTP_URL = "http_url"
    OS_BUILD = "os_build"
    OS_KERNEL_VERSION = "os_kernel_version"
    DEVICE_NAME = "device_name"
    DEVICE_BRAND = "device_brand"
    DEVICE_LOCALE = "device_locale"
    DEVICE_UUID = "device_uuid"
    DEVICE_ARCH = "device_arch"
    DEVICE_BATTERY_LEVEL = "device_battery_level"
    DEVICE_ORIENTATION = "device_orientation"
    DEVICE_SIMULATOR = "device_simulator"
    DEVICE_ONLINE = "device_online"
    DEVICE_CHARGING = "device_charging"
    GEO_COUNTRY_CODE = "geo_country_code"
    GEO_REGION = "geo_region"
    GEO_CITY = "geo_city"
    ERROR_TYPE = "exception_stacks.type"
    ERROR_VALUE = "exception_stacks.value"
    ERROR_MECHANISM = "exception_stacks.mechanism_type"
    ERROR_HANDLED = "exception_stacks.mechanism_handled"
    STACK_ABS_PATH = "exception_frames.abs_path"
    STACK_FILENAME = "exception_frames.filename"
    STACK_PACKAGE = "exception_frames.package"
    STACK_MODULE = "exception_frames.module"
    STACK_FUNCTION = "exception_frames.function"
    STACK_IN_APP = "exception_frames.in_app"
    STACK_COLNO = "exception_frames.colno"
    STACK_LINENO = "exception_frames.lineno"
    STACK_STACK_LEVEL = "exception_frames.stack_level"
    CONTEXTS_KEY = "contexts.key"
    CONTEXTS_VALUE = "contexts.value"


class Filter(object):
    def __init__(
        self, start=None, end=None, conditions=None, project_id=None, group_id=None, event_id=None
    ):
        self.start = start
        self.end = end
        self.conditions = conditions
        self.project_id = project_id
        self.group_id = group_id
        self.event_id = event_id


class EventStorage(Service):
    __all__ = (
        "minimal_columns",
        "full_columns",
        "get_event_by_id",
        "get_events",
        "get_prev_event_id",
        "get_next_event_id",
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
        Columns.EMAIL,
        Columns.IP_ADDRESS,
        Columns.USER_ID,
        Columns.USERNAME,
    ]

    def get_event_by_id(self, project_id, event_id, additional_columns):
        """
        Gets a single event given a project_id and event_id.

        Keyword arguments:
        project_id (int): Project ID
        event_id (str): Event ID
        additional_columns: (Sequence[Column]) - List of addition columns to fetch - default None
        """
        raise NotImplementedError

    def get_events(
        self, start, end, additional_columns, conditions, filter_keys, orderby, limit, offset
    ):
        """
        Fetches a list of events given a set of criteria.

        Keyword arguments:
        start (DateTime): Start datetime - default datetime.utcfromtimestamp(0)
        end (DateTime): End datetime - default datetime.utcnow()
        additional_columns (Sequence[Column]): List of additional columns to fetch - default None
        conditions (Sequence[Sequence[str, str, Any]]): List of conditions to fetch - default None
        filter_keys (Mapping[str, Any]): Filter keys - default None
        orderby (Sequence[str]): List of fields to order by - default ['-time', '-event_id']
        limit (int): Query limit - default 100
        offset (int): Query offset - default 0
        """
        raise NotImplementedError

    def get_next_event_id(self, event, conditions, filter_keys):
        """
        Gets the next event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object

        Keyword arguments:
        conditions (Sequence[Sequence[str, str, Any]]): List of conditions - default None
        filter_keys (Mapping[str, Any]): Filter keys - default None
        """
        raise NotImplementedError

    def get_prev_event_id(self, event, conditions, filter_keys):
        """
        Gets the previous event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object

        Keyword arguments:
        conditions (Sequence[Sequence[str, str, Any]]): List of conditions - default None
        filter_keys (Mapping[str, Any]): Filter keys - default None
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
