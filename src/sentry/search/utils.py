from __future__ import absolute_import, division, print_function

from collections import defaultdict
from datetime import datetime, timedelta

import six
from django.db import DataError
from django.utils import timezone

from sentry.constants import STATUS_CHOICES
from sentry.models import EventUser, KEYWORD_MAP, Release, Team, User
from sentry.search.base import ANY
from sentry.utils.auth import find_users
from sentry.utils.compat import map


class InvalidQuery(Exception):
    pass


def get_user_tag(projects, key, value):
    # TODO(dcramer): do something with case of multiple matches
    try:
        lookup = EventUser.attr_from_keyword(key)
        euser = EventUser.objects.filter(
            project_id__in=[p.id for p in projects], **{lookup: value}
        )[0]
    except (KeyError, IndexError):
        return u"{}:{}".format(key, value)
    except DataError:
        raise InvalidQuery(u"malformed '{}:' query '{}'.".format(key, value))
    return euser.tag_value


def parse_status_value(value):
    if value in STATUS_CHOICES:
        return STATUS_CHOICES[value]
    if value in STATUS_CHOICES.values():
        return value
    raise ValueError("Invalid status value")


def parse_duration(value, interval):
    try:
        value = float(value)
    except ValueError:
        raise InvalidQuery(u"{} is not a valid duration value".format(value))

    if interval == "ms":
        delta = timedelta(milliseconds=value)
    elif interval == "s":
        delta = timedelta(seconds=value)
    elif interval in ["min", "m"]:
        delta = timedelta(minutes=value)
    elif interval in ["hr", "h"]:
        delta = timedelta(hours=value)
    elif interval in ["day", "d"]:
        delta = timedelta(days=value)
    elif interval in ["wk", "w"]:
        delta = timedelta(days=value * 7)
    else:
        raise InvalidQuery(
            u"{} is not a valid duration type, must be ms, s, min, m, hr, h, day, d, wk or w".format(
                interval
            )
        )

    return delta.total_seconds() * 1000.0


def parse_datetime_range(value):
    try:
        flag, count, interval = value[0], int(value[1:-1]), value[-1]
    except (ValueError, TypeError, IndexError):
        raise InvalidQuery(u"{} is not a valid datetime query".format(value))

    if flag not in ("+", "-"):
        raise InvalidQuery(u"{} is not a valid datetime query".format(value))

    if interval == "h":
        delta = timedelta(hours=count)
    elif interval == "w":
        delta = timedelta(days=count * 7)
    elif interval == "d":
        delta = timedelta(days=count)
    elif interval == "m":
        delta = timedelta(minutes=count)
    else:
        raise InvalidQuery(u"{} is not a valid datetime query".format(value))

    if flag == "-":
        return ((timezone.now() - delta, True), None)
    else:
        return (None, (timezone.now() - delta, True))


DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%S"
DATETIME_FORMAT_MICROSECONDS = "%Y-%m-%dT%H:%M:%S.%f"


def parse_unix_timestamp(value):
    return datetime.utcfromtimestamp(float(value)).replace(tzinfo=timezone.utc)


def parse_datetime_string(value):
    # timezones are not supported and are assumed UTC
    if value[-1:] == "Z":
        value = value[:-1]
    if len(value) >= 6 and value[-6] == "+":
        value = value[:-6]

    for format in [DATETIME_FORMAT_MICROSECONDS, DATETIME_FORMAT, DATE_FORMAT]:
        try:
            return datetime.strptime(value, format).replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    try:
        return parse_unix_timestamp(value)
    except ValueError:
        pass

    raise InvalidQuery(u"{} is not a valid ISO8601 date query".format(value))


def parse_datetime_comparison(value):
    if value[:2] == ">=":
        return ((parse_datetime_string(value[2:]), True), None)
    if value[:2] == "<=":
        return (None, (parse_datetime_string(value[2:]), True))
    if value[:1] == ">":
        return ((parse_datetime_string(value[1:]), False), None)
    if value[:1] == "<":
        return (None, (parse_datetime_string(value[1:]), False))

    raise InvalidQuery(u"{} is not a valid datetime query".format(value))


def parse_datetime_value(value):
    # timezones are not supported and are assumed UTC
    if value[-1:] == "Z":
        value = value[:-1]
    if len(value) >= 6 and value[-6] == "+":
        value = value[:-6]

    result = None

    # A value that only specifies the date (without a time component) should be
    # expanded to an interval that spans the entire day.
    try:
        result = datetime.strptime(value, DATE_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    else:
        return ((result, True), (result + timedelta(days=1), False))

    # A value that contains the time should converted to an interval.
    for format in [DATETIME_FORMAT, DATETIME_FORMAT_MICROSECONDS]:
        try:
            result = datetime.strptime(value, format).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
        else:
            break  # avoid entering the else clause below
    else:
        try:
            result = parse_unix_timestamp(value)
        except ValueError:
            pass

    if result is None:
        raise InvalidQuery(u"{} is not a valid datetime query".format(value))

    return ((result - timedelta(minutes=5), True), (result + timedelta(minutes=6), False))


def parse_datetime_expression(value):
    if value.startswith(("-", "+")):
        return parse_datetime_range(value)
    elif value.startswith((">", "<", "<=", ">=")):
        return parse_datetime_comparison(value)
    else:
        return parse_datetime_value(value)


def get_date_params(value, from_field, to_field):
    date_from, date_to = parse_datetime_expression(value)
    result = {}
    if date_from is not None:
        date_from_value, date_from_inclusive = date_from
        result.update(
            {from_field: date_from_value, u"{}_inclusive".format(from_field): date_from_inclusive}
        )
    if date_to is not None:
        date_to_value, date_to_inclusive = date_to
        result.update(
            {to_field: date_to_value, u"{}_inclusive".format(to_field): date_to_inclusive}
        )
    return result


def parse_team_value(projects, value, user):
    return Team.objects.filter(
        slug__iexact=value[1:], projectteam__project__in=projects
    ).first() or Team(id=0)


def parse_actor_value(projects, value, user):
    if value.startswith("#"):
        return parse_team_value(projects, value, user)
    return parse_user_value(value, user)


def parse_user_value(value, user):
    if value == "me":
        return user

    try:
        return find_users(value)[0]
    except IndexError:
        # XXX(dcramer): hacky way to avoid showing any results when
        # an invalid user is entered
        return User(id=0)


def get_latest_release(projects, environments, organization_id=None):
    if organization_id is None:
        project = projects[0]
        if hasattr(project, "organization_id"):
            organization_id = project.organization_id
        else:
            return ""

    release_qs = Release.objects.filter(organization_id=organization_id, projects__in=projects)

    if environments:
        release_qs = release_qs.filter(
            releaseprojectenvironment__environment__id__in=[
                environment.id for environment in environments
            ]
        )

    return (
        release_qs.extra(select={"sort": "COALESCE(date_released, date_added)"})
        .order_by("-sort")
        .values_list("version", flat=True)[:1]
        .get()
    )


def parse_release(value, projects, environments, organization_id=None):
    if value == "latest":
        try:
            return get_latest_release(projects, environments, organization_id)
        except Release.DoesNotExist:
            # Should just get no results here, so return an empty release name.
            return ""
    else:
        return value


numeric_modifiers = [
    (
        ">=",
        lambda field, value: {
            u"{}_lower".format(field): value,
            u"{}_lower_inclusive".format(field): True,
        },
    ),
    (
        "<=",
        lambda field, value: {
            u"{}_upper".format(field): value,
            u"{}_upper_inclusive".format(field): True,
        },
    ),
    (
        ">",
        lambda field, value: {
            u"{}_lower".format(field): value,
            u"{}_lower_inclusive".format(field): False,
        },
    ),
    (
        "<",
        lambda field, value: {
            u"{}_upper".format(field): value,
            u"{}_upper_inclusive".format(field): False,
        },
    ),
]


def get_numeric_field_value(field, raw_value, type=int):
    try:
        for modifier, function in numeric_modifiers:
            if raw_value.startswith(modifier):
                return function(field, type(raw_value[len(modifier) :]))
        else:
            return {field: type(raw_value)}
    except ValueError:
        msg = u'"{}" could not be converted to a number.'.format(raw_value)
        raise InvalidQuery(msg)


def tokenize_query(query):
    """
    Tokenizes a standard Sentry search query.

    Example:
    >>> query = 'is:resolved foo bar tag:value'
    >>> tokenize_query(query)
    {
        'is': ['resolved'],
        'query': ['foo', 'bar'],
        'tag': ['value'],
    }

    Has a companion implementation in static/app/utils/tokenizeSearch.tsx
    """
    result = defaultdict(list)
    query_params = defaultdict(list)
    tokens = split_query_into_tokens(query)
    for token in tokens:
        if token.upper() in ["OR", "AND"] or token.strip("()") == "":
            continue

        state = "query"
        for idx, char in enumerate(token):
            next_char = token[idx + 1] if idx < len(token) - 1 else None
            if idx == 0 and char in ('"', "'", ":"):
                break
            if char == ":":
                if next_char in (":", " "):
                    state = "query"
                else:
                    state = "tags"
                break
        query_params[state].append(token)

    if "query" in query_params:
        result["query"] = map(format_query, query_params["query"])
    for tag in query_params["tags"]:
        key, value = format_tag(tag)
        result[key].append(value)
    return dict(result)


def format_tag(tag):
    """
    Splits tags on ':' and removes enclosing quotes and grouping parens if present and returns
    returns both sides of the split as strings

    Example:
    >>> format_tag('user:foo')
    'user', 'foo'
    >>>format_tag('user:"foo bar"'')
    'user', 'foo bar'
    """
    idx = tag.index(":")
    key = tag[:idx].lstrip("(").strip('"')
    value = tag[idx + 1 :].rstrip(")").strip('"')
    return key, value


def format_query(query):
    """
    Strips enclosing quotes and grouping parens from queries if present.

    Example:
    >>> format_query('"user:foo bar"')
    'user:foo bar'
    """
    return query.strip('"()')


def split_query_into_tokens(query):
    """
    Splits query string into tokens for parsing by 'tokenize_query'.
    Returns list of strigs
    Rules:
    Split on whitespace
        Unless
        - inside enclosing quotes -> 'user:"foo    bar"'
        - end of last word is a ':' -> 'user:  foo'

    Example:
    >>> split_query_into_tokens('user:foo user: bar  user"foo bar' foo  bar) =>
    ['user:foo', 'user: bar', 'user"foo bar"', 'foo',  'bar']
    """
    tokens = []
    token = ""
    quote_enclosed = False
    quote_type = None
    end_of_prev_word = None
    for idx, char in enumerate(query):
        next_char = query[idx + 1] if idx < len(query) - 1 else None
        token += char
        if next_char and not char.isspace() and next_char.isspace():
            end_of_prev_word = char
        if char.isspace() and not quote_enclosed and end_of_prev_word != ":":
            if not token.isspace():
                tokens.append(token.strip(" "))
                token = ""
        if char in ("'", '"'):
            if not quote_enclosed or quote_type == char:
                quote_enclosed = not quote_enclosed
                if quote_enclosed:
                    quote_type = char
    if not token.isspace():
        tokens.append(token.strip(" "))
    return tokens


def parse_query(projects, query, user, environments):
    # TODO(dcramer): handle query being wrapped in quotes
    tokens = tokenize_query(query)

    results = {"tags": {}, "query": []}
    for key, token_list in six.iteritems(tokens):
        for value in token_list:
            if key == "query":
                results["query"].append(value)
            elif key == "is":
                if value == "unassigned":
                    results["unassigned"] = True
                elif value == "assigned":
                    results["unassigned"] = False
                else:
                    try:
                        results["status"] = STATUS_CHOICES[value]
                    except KeyError:
                        raise InvalidQuery(u"'is:' had unknown status code '{}'.".format(value))
            elif key == "assigned":
                results["assigned_to"] = parse_actor_value(projects, value, user)
            elif key == "bookmarks":
                results["bookmarked_by"] = parse_user_value(value, user)
            elif key == "subscribed":
                results["subscribed_by"] = parse_user_value(value, user)
            elif key in ("first-release", "firstRelease"):
                results["first_release"] = parse_release(value, projects, environments)
            elif key == "release":
                results["tags"]["sentry:release"] = parse_release(value, projects, environments)
            elif key == "dist":
                results["tags"]["sentry:dist"] = value
            elif key == "user":
                if ":" in value:
                    comp, value = value.split(":", 1)
                else:
                    comp = "id"
                results["tags"]["sentry:user"] = get_user_tag(projects, comp, value)
            elif key == "has":
                if value == "user":
                    value = "sentry:user"
                elif value == "release":
                    value = "sentry:release"
                # `has:x` query should not take precedence over `x:value` queries
                if value not in results["tags"]:
                    results["tags"][value] = ANY
            elif key in ("age", "firstSeen"):
                results.update(get_date_params(value, "age_from", "age_to"))
            elif key in ("last_seen", "lastSeen"):
                results.update(get_date_params(value, "last_seen_from", "last_seen_to"))
            elif key == "activeSince":
                results.update(get_date_params(value, "active_at_from", "active_at_to"))
            elif key.startswith("user."):
                results["tags"]["sentry:user"] = get_user_tag(projects, key.split(".", 1)[1], value)
            elif key == "event.timestamp":
                results.update(get_date_params(value, "date_from", "date_to"))
            elif key == "timesSeen":
                results.update(get_numeric_field_value("times_seen", value))
            else:
                results["tags"][key] = value

    results["query"] = " ".join(results["query"])

    return results


def convert_user_tag_to_query(key, value):
    """
    Converts a user tag to a query string that can be used to search for that
    user. Returns None if not a user tag.
    """
    if key == "user" and ":" in value:
        sub_key, value = value.split(":", 1)
        if KEYWORD_MAP.get_key(sub_key, None):
            return 'user.%s:"%s"' % (sub_key, value.replace('"', '\\"'))
