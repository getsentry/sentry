from __future__ import absolute_import

from copy import deepcopy

import sentry_sdk

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
    having (Sequence[str, str, Any]]): List of having conditions to filter by - default None
    project_ids (Sequence[int]): List of project IDs to fetch - default None
    group_ids (Sequence[int]): List of group IDs to fetch - default None
    event_ids (Sequence[int]): List of event IDs to fetch - default None

    selected_columns (Sequence[str]): List of columns to select
    aggregations (Sequence[Any, str|None, str]): Aggregate functions to fetch.
    groupby (Sequence[str]): List of columns to group results by

    condition_aggregates (Sequence[str]): List of aggregates used in the condition
    aliases (Dict[str, Alias]): Endpoint specific aliases
    """

    def __init__(
        self,
        start=None,
        end=None,
        conditions=None,
        having=None,
        user_id=None,
        organization_id=None,
        project_ids=None,
        group_ids=None,
        event_ids=None,
        selected_columns=None,
        aggregations=None,
        rollup=None,
        groupby=None,
        orderby=None,
        condition_aggregates=None,
        aliases=None,
    ):
        self.start = start
        self.end = end
        self.conditions = conditions
        self.having = having
        self.user_id = user_id
        self.organization_id = organization_id
        self.project_ids = project_ids
        self.group_ids = group_ids
        self.event_ids = event_ids

        self.rollup = rollup
        self.selected_columns = selected_columns if selected_columns is not None else []
        self.aggregations = aggregations if aggregations is not None else []
        self.groupby = groupby
        self.orderby = orderby
        self.condition_aggregates = condition_aggregates
        self.aliases = aliases

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

    @property
    def params(self):
        """
        Get the datetime parameters as a dictionary
        """
        return {
            "start": self.start,
            "end": self.end,
            # needed for the key transaction column
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "project_id": self.project_ids,
        }

    def update_with(self, updates):
        keys = ("selected_columns", "aggregations", "conditions", "orderby", "groupby")
        for key in keys:
            if key in updates:
                setattr(self, key, updates[key])

    def clone(self):
        return deepcopy(self)


class EventStorage(Service):
    __all__ = (
        "minimal_columns",
        "create_event",
        "get_event_by_id",
        "get_events",
        "get_unfetched_events",
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

    def get_events(
        self,
        snuba_filter,
        orderby=None,
        limit=100,
        offset=0,
        referrer="eventstore.get_events",  # NOQA
    ):
        """
        Fetches a list of events given a set of criteria.

        Arguments:
        snuba_filter (Filter): Filter
        orderby (Sequence[str]): List of fields to order by - default ['-time', '-event_id']
        limit (int): Query limit - default 100
        offset (int): Query offset - default 0
        referrer (string): Referrer - default "eventstore.get_events"
        """
        raise NotImplementedError

    def get_unfetched_events(
        self,
        snuba_filter,
        orderby=None,
        limit=100,
        offset=0,
        referrer="eventstore.get_unfetched_events",  # NOQA
    ):
        """
        Same as get_events but returns events without their node datas loaded.
        Only the event ID, projectID, groupID and timestamp field will be present without
        an additional fetch to nodestore.

        Used for fetching large volumes of events that do not need data loaded
        from nodestore. Currently this is just used for event data deletions where
        we just need the event IDs in order to process the deletions.

        Arguments:
        snuba_filter (Filter): Filter
        orderby (Sequence[str]): List of fields to order by - default ['-time', '-event_id']
        limit (int): Query limit - default 100
        offset (int): Query offset - default 0
        referrer (string): Referrer - default "eventstore.get_unfetched_events"
        """
        raise NotImplementedError

    def get_event_by_id(self, project_id, event_id):
        """
        Gets a single event given a project_id and event_id.

        Arguments:
        project_id (int): Project ID
        event_id (str): Event ID
        """
        raise NotImplementedError

    def get_next_event_id(self, event, snuba_filter):  # NOQA
        """
        Gets the next event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        snuba_filter (Filter): Filter
        """
        raise NotImplementedError

    def get_prev_event_id(self, event, snuba_filter):  # NOQA
        """
        Gets the previous event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        snuba_filter (Filter): Filter
        """
        raise NotImplementedError

    def get_earliest_event_id(self, event, snuba_filter):  # NOQA
        """
        Gets the earliest event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        snuba_filter (Filter): Filter
        """
        raise NotImplementedError

    def get_latest_event_id(self, event, snuba_filter):  # NOQA
        """
        Gets the latest event given a current event and some conditions/filters.
        Returns a tuple of (project_id, event_id)

        Arguments:
        event (Event): Event object
        snuba_filter (Filter): Filter
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
        the returned blobs to the NodeDatas.

        It's not necessary to bind a single Event object since data will be lazily
        fetched on any attempt to access a property.
        """
        with sentry_sdk.start_span(op="eventstore.base.bind_nodes"):
            object_node_list = [
                (i, getattr(i, node_name)) for i in object_list if getattr(i, node_name).id
            ]

            # Remove duplicates from the list of nodes to be fetched
            node_ids = list({n.id for _, n in object_node_list})
            if not node_ids:
                return

            node_results = nodestore.get_multi(node_ids)

            for item, node in object_node_list:
                data = node_results.get(node.id) or {}
                node.bind_data(data, ref=node.get_ref(item))
