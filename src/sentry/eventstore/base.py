from __future__ import absolute_import


from sentry import nodestore
from sentry.snuba.events import Columns
from sentry.utils.services import Service

from .models import Event


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
            filter_keys["group_id"] = self.group_ids

        if self.event_ids:
            filter_keys["event_id"] = self.event_ids

        return filter_keys


class EventStorage(Service):
    __all__ = (
        "minimal_columns",
        "full_columns",
        "create_event",
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

    def get_events(
        self,
        filter,
        additional_columns=None,
        orderby=None,
        limit=100,
        offset=0,
        referrer="eventstore.get_events",
    ):
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

    def get_event_by_id(self, project_id, event_id, additional_columns=None):
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

    def create_event(self, project_id=None, event_id=None, group_id=None, data=None):
        """
        Returns an Event from processed data
        """
        return Event(project_id=project_id, event_id=event_id, group_id=group_id, data=data)

    def bind_nodes(self, object_list, node_name="data"):
        """
        For a list of Event objects, and a property name where we might find an
        (unfetched) NodeData on those objects, fetch all the data blobs for
        those NodeDatas with a single multi-get command to nodestore, and bind
        the returned blobs to the NodeDatas

        For binding a single Event object (most use cases), it's easier to use
        event.bind_node_data().
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
