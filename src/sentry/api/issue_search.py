from __future__ import absolute_import

from django.utils.functional import cached_property
from parsimonious.exceptions import IncompleteParseError

from sentry.api.event_search import (
    event_search_grammar,
    InvalidSearchQuery,
    SearchFilter,
    AggregateFilter,
    SearchKey,
    SearchValue,
    SearchVisitor,
)
from sentry.constants import STATUS_CHOICES
from sentry.search.utils import (
    parse_actor_value,
    parse_user_value,
    parse_release,
    parse_status_value,
)
from sentry.utils.compat import map


class IssueSearchVisitor(SearchVisitor):
    key_mappings = {
        "assigned_to": ["assigned"],
        "bookmarked_by": ["bookmarks"],
        "subscribed_by": ["subscribed"],
        "first_release": ["first-release", "firstRelease"],
        "first_seen": ["age", "firstSeen"],
        "last_seen": ["lastSeen"],
        "active_at": ["activeSince"],
        # TODO: Special case this in the backends, since they currently rely
        # on date_from and date_to explicitly
        "date": ["event.timestamp"],
        "times_seen": ["timesSeen"],
        "sentry:dist": ["dist"],
    }
    numeric_keys = SearchVisitor.numeric_keys.union(["times_seen"])
    date_keys = SearchVisitor.date_keys.union(["active_at", "date"])

    @cached_property
    def is_filter_translators(self):
        is_filter_translators = {
            "assigned": (SearchKey("unassigned"), SearchValue(False)),
            "unassigned": (SearchKey("unassigned"), SearchValue(True)),
        }
        for status_key, status_value in STATUS_CHOICES.items():
            is_filter_translators[status_key] = (SearchKey("status"), SearchValue(status_value))
        return is_filter_translators

    def visit_is_filter(self, node, children):
        # the key is "is" here, which we don't need
        negation, _, _, search_value = children

        if search_value.raw_value not in self.is_filter_translators:
            raise InvalidSearchQuery(
                'Invalid value for "is" search, valid values are {}'.format(
                    sorted(self.is_filter_translators.keys())
                )
            )

        search_key, search_value = self.is_filter_translators[search_value.raw_value]

        operator = "!=" if self.is_negated(negation) else "="

        return SearchFilter(search_key, operator, search_value)

    def visit_boolean_operator(self, node, children):
        raise InvalidSearchQuery(
            'Boolean statements containing "OR" or "AND" are not supported in this search'
        )


def parse_search_query(query):
    try:
        tree = event_search_grammar.parse(query)
    except IncompleteParseError as e:
        raise InvalidSearchQuery(
            "%s %s"
            % (
                u"Parse error: %r (column %d)." % (e.expr.name, e.column()),
                "This is commonly caused by unmatched-parentheses. Enclose any text in double quotes.",
            )
        )
    return IssueSearchVisitor(allow_boolean=False).visit(tree)


def convert_actor_value(value, projects, user, environments):
    return parse_actor_value(projects, value, user)


def convert_user_value(value, projects, user, environments):
    return parse_user_value(value, user)


def convert_release_value(value, projects, user, environments):
    return parse_release(value, projects, environments)


def convert_status_value(value, projects, user, environments):
    try:
        return parse_status_value(value)
    except ValueError:
        raise InvalidSearchQuery(u"invalid status value of '{}'".format(value))


value_converters = {
    "assigned_to": convert_actor_value,
    "bookmarked_by": convert_user_value,
    "subscribed_by": convert_user_value,
    "first_release": convert_release_value,
    "release": convert_release_value,
    "status": convert_status_value,
}


def convert_query_values(search_filters, projects, user, environments):
    """
    Accepts a collection of SearchFilter objects and converts their values into
    a specific format, based on converters specified in `value_converters`.
    :param search_filters: Collection of `SearchFilter` objects.
    :param projects: List of projects being searched across
    :param user: The user making the search
    :return: New collection of `SearchFilters`, which may have converted values.
    """

    def convert_search_filter(search_filter):
        if search_filter.key.name in value_converters:
            converter = value_converters[search_filter.key.name]
            new_value = converter(search_filter.value.raw_value, projects, user, environments)
            search_filter = search_filter._replace(value=SearchValue(new_value))
        elif isinstance(search_filter, AggregateFilter):
            raise InvalidSearchQuery(
                u"Aggregate filters ({}) are not supported in issue searches.".format(
                    search_filter.key.name
                )
            )
        return search_filter

    return map(convert_search_filter, search_filters)
