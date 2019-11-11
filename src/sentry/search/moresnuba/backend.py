from __future__ import absolute_import
import logging
from sentry.search.snuba import SnubaSearchBackend
from sentry.utils import snuba


# TODO:
# Let's give this backend a self explanatory name and a docstring that explains why it exists.
# Written this way it would be very hard for someone reading the code to understand the design.
# This backend is intended to "extend" the current events search backend.
# The goal of it is to transition to searches that use snuba more heavily - perhaps ideally not using postgres/django models at all

# This file overrides certain methods, and variables in order to do this.
# Feel free to break the base backend up more if you need to modify certain bits of functionality in here.
# We alias field names with "groups." or "events." where appropriate, use a different dataset,
# and remove some issue_only_fields and query building magic from the backup.

# We are running this backend alongside the original one and logging results.
# Eventually, we hope to remove the original backend and use this if it performs well.
class MoreSnubaSearchBackend(SnubaSearchBackend):
    QUERY_DATASET = snuba.Dataset.Groups
    ISSUE_FIELD_NAME = "events.issue"
    logger = logging.getLogger("sentry.search.moresnuba")
    dependency_aggregations = {"priority": ["events.last_seen", "times_seen"]}
    issue_only_fields = set(
        [
            "query",
            "status",
            "bookmarked_by",
            "assigned_to",
            "unassigned",
            "subscribed_by",
            "active_at",
            "first_release",
            "first_seen",
        ]
    )
    sort_strategies = {
        # TODO: If not using environment filters, could these sort methods use last_seen and first_seen from groups instead? so only add prefix conditionally?
        "date": "events.last_seen",
        "freq": "times_seen",
        "new": "events.first_seen",
        "priority": "priority",
    }

    aggregation_defs = {
        "times_seen": ["count()", ""],
        "events.first_seen": ["multiply(toUInt64(min(events.timestamp)), 1000)", ""],
        "events.last_seen": ["multiply(toUInt64(max(events.timestamp)), 1000)", ""],
        # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
        "priority": ["toUInt64(plus(multiply(log(times_seen), 600), `events.last_seen`))", ""],
        # Only makes sense with WITH TOTALS, returns 1 for an individual group.
        "total": ["uniq", "events.issue"],
    }

    def __init__(self):
        self.issue_only_fields.discard("active_at")
        self.issue_only_fields.discard("first_seen")
        self.issue_only_fields.discard("first_release")
        self.issue_only_fields.discard("status")

    # def query(
    #     self,
    #     projects,
    #     environments=None,
    #     sort_by="date",
    #     limit=100,
    #     cursor=None,
    #     count_hits=False,
    #     paginator_options=None,
    #     search_filters=None,
    #     date_from=None,
    #     date_to=None,
    # ):
    #     from sentry.models import Group, GroupStatus, GroupSubscription
    #     alias_variable_definitions();
    #     return super(MoreSnubaSearchBackend,self).query()

    # def alias_variable_definitions():
    #    pass

    def get_queryset_builder_conditions(
        self,
        projects,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        search_filters=None,
        date_from=None,
        date_to=None,
    ):
        # We override this function to remove status and active_at
        qs_builder_conditions = super(MoreSnubaSearchBackend, self).get_queryset_builder_conditions(
            projects,
            environments,
            sort_by,
            limit,
            cursor,
            count_hits,
            paginator_options,
            search_filters,
            date_from,
            date_to,
        )

        del qs_builder_conditions["status"]
        del qs_builder_conditions["active_at"]

        return qs_builder_conditions

    def build_environment_and_release_queryset(
        self, projects, group_queryset, environments, search_filters
    ):
        # Override the base function, which filters the group_queryset,
        # and do no postgres filter building for first_release and first_seen
        # Just return it unmodified. We do this filter in snuba now.
        return group_queryset

    def modify_converted_filter(self, search_filter, converted_filter, environment_ids=None):
        table_alias = ""
        converted_filter = self.modify_filter_if_date(search_filter, converted_filter)

        # TODO: What is this still now doing and is it neccessary?
        if search_filter.key.name in ["first_seen", "last_seen", "first_release"]:
            if environment_ids is not None:
                table_alias = "events."
            else:
                table_alias = "groups."

            if isinstance(converted_filter[0], list):
                converted_filter[0][1][0] = table_alias + converted_filter[0][1][0]
            else:
                converted_filter[0] = table_alias + converted_filter[0]

        return table_alias, converted_filter

    def modify_filter_if_date(self, search_filter, converted_filter):
        import datetime

        special_date_names = ["groups.active_at", "first_seen", "last_seen"]
        if search_filter.key.name in special_date_names:
            # Need to get '2018-02-06T03:35:54' out of 1517888878000
            datetime_value = datetime.datetime.fromtimestamp(converted_filter[2] / 1000)
            datetime_value = datetime_value.replace(microsecond=0).isoformat().replace("+00:00", "")
            converted_filter[2] = datetime_value
        return converted_filter
