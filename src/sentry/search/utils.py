from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    FrozenSet,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
)

from django.db import DataError, connections, router
from django.utils import timezone

from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user

if TYPE_CHECKING:
    from sentry.api.event_search import SearchFilter

from sentry.models.environment import Environment
from sentry.models.group import STATUS_QUERY_CHOICES, Group
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.release import Release, follows_semver_versioning_scheme
from sentry.models.team import Team
from sentry.models.user import User
from sentry.search.base import ANY
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES
from sentry.utils.eventuser import KEYWORD_MAP, EventUser


class InvalidQuery(Exception):
    pass


def get_user_tag(projects: Sequence[Project], key: str, value: str) -> str:
    # TODO(dcramer): do something with case of multiple matches
    try:
        euser = EventUser.for_projects(projects, {key: [value]}, result_limit=1)[0]
    except (KeyError, IndexError):
        return f"{key}:{value}"
    except DataError:
        raise InvalidQuery(f"malformed '{key}:' query '{value}'.")

    return euser.tag_value


def parse_status_value(status: Union[str, int]) -> int:
    if status in STATUS_QUERY_CHOICES:
        return int(STATUS_QUERY_CHOICES[status])
    if status in STATUS_QUERY_CHOICES.values():
        return int(status)
    raise ValueError("Invalid status value")


def parse_substatus_value(substatus: Union[str, int]) -> int:
    if substatus in SUBSTATUS_UPDATE_CHOICES:
        return int(SUBSTATUS_UPDATE_CHOICES[substatus])
    if substatus in SUBSTATUS_UPDATE_CHOICES.values():
        return int(substatus)
    raise ValueError("Invalid substatus value")


def parse_duration(value: str, interval: str) -> float:
    try:
        duration = float(value)
    except ValueError:
        raise InvalidQuery(f"{value} is not a valid duration value")

    try:
        if interval == "ms":
            delta = timedelta(milliseconds=duration)
        elif interval == "s":
            delta = timedelta(seconds=duration)
        elif interval in ["min", "m"]:
            delta = timedelta(minutes=duration)
        elif interval in ["hr", "h"]:
            delta = timedelta(hours=duration)
        elif interval in ["day", "d"]:
            delta = timedelta(days=duration)
        elif interval in ["wk", "w"]:
            delta = timedelta(days=duration * 7)
        else:
            raise InvalidQuery(
                f"{interval} is not a valid duration type, must be ms, s, min, m, hr, h, day, d, wk or w"
            )
    except OverflowError:
        # don't use duration so we show the value the user entered, ie. 9 instead of 9.0
        raise InvalidQuery(
            f"{value}{interval} is too large of a value, the maximum value is 999999999 days"
        )

    return delta.total_seconds() * 1000.0


def parse_size(value: str, size: str) -> float:
    """Returns in total bytes"""
    try:
        size_value = float(value)
    except ValueError:
        raise InvalidQuery(f"{value} is not a valid size value")

    if size == "bit":
        byte = size_value / 8
    elif size == "nb":
        byte = size_value / 2
    elif size == "bytes":
        byte = size_value
    elif size == "kb":
        byte = size_value * 1000
    elif size == "mb":
        byte = size_value * 1000**2
    elif size == "gb":
        byte = size_value * 1000**3
    elif size == "tb":
        byte = size_value * 1000**4
    elif size == "pb":
        byte = size_value * 1000**5
    elif size == "eb":
        byte = size_value * 1000**6
    elif size == "zb":
        byte = size_value * 1000**7
    elif size == "yb":
        byte = size_value * 1000**8
    elif size == "kib":
        byte = size_value * 1024
    elif size == "mib":
        byte = size_value * 1024**2
    elif size == "gib":
        byte = size_value * 1024**3
    elif size == "tib":
        byte = size_value * 1024**4
    elif size == "pib":
        byte = size_value * 1024**5
    elif size == "eib":
        byte = size_value * 1024**6
    elif size == "zib":
        byte = size_value * 1024**7
    elif size == "yib":
        byte = size_value * 1024**8
    else:
        raise InvalidQuery(
            f"{size} is not a valid size type, must be bit, bytes, kb, mb, gb, tb, pb, eb, zb, yb, kib, mib, gib, tib, pib, eib, zib, yib"
        )

    return byte


def parse_percentage(value: str) -> float:
    try:
        parsed_value = float(value)
    except ValueError:
        raise InvalidQuery(f"{value} is not a valid percentage value")

    return parsed_value / 100


def parse_numeric_value(value: str, suffix: Optional[str] = None) -> float:
    try:
        parsed_value = float(value)
    except ValueError:
        raise InvalidQuery("Invalid number")

    if not suffix:
        return parsed_value

    numeric_multiples = {"k": 10.0**3, "m": 10.0**6, "b": 10.0**9}
    if suffix not in numeric_multiples:
        raise InvalidQuery(f"{suffix} is not a valid number suffix, must be k, m or b")

    return parsed_value * numeric_multiples[suffix]


def parse_datetime_range(
    value: str,
) -> Union[tuple[tuple[datetime, bool], None], tuple[None, tuple[datetime, bool]]]:
    try:
        flag, count, interval = value[0], int(value[1:-1]), value[-1]
    except (ValueError, TypeError, IndexError):
        raise InvalidQuery(f"{value} is not a valid datetime query")

    if flag not in ("+", "-"):
        raise InvalidQuery(f"{value} is not a valid datetime query")

    if interval == "h":
        delta = timedelta(hours=count)
    elif interval == "w":
        delta = timedelta(days=count * 7)
    elif interval == "d":
        delta = timedelta(days=count)
    elif interval == "m":
        delta = timedelta(minutes=count)
    else:
        raise InvalidQuery(f"{value} is not a valid datetime query")

    if flag == "-":
        return (timezone.now() - delta, True), None
    else:
        return None, (timezone.now() - delta, True)


DATE_FORMAT = "%Y-%m-%d"


def parse_unix_timestamp(value: str) -> datetime:
    return datetime.utcfromtimestamp(float(value)).replace(tzinfo=timezone.utc)


def parse_iso_timestamp(value: str) -> datetime:
    # datetime.fromisoformat does not support parsing 'Z'
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))

    # Values with no timezone info will default to UTC
    if not date.tzinfo:
        date.replace(tzinfo=timezone.utc)

    # Convert to UTC
    return datetime.fromtimestamp(date.timestamp(), tz=timezone.utc)


def parse_datetime_string(value: str) -> datetime:
    try:
        return parse_iso_timestamp(value)
    except ValueError:
        pass

    try:
        return parse_unix_timestamp(value)
    except ValueError:
        pass

    raise InvalidQuery(f"{value} is not a valid ISO8601 date query")


ParsedDatetime = Optional[Tuple[datetime, bool]]


def parse_datetime_comparison(
    value: str,
) -> tuple[ParsedDatetime, ParsedDatetime]:
    if value[:2] == ">=":
        return (parse_datetime_string(value[2:]), True), None
    if value[:2] == "<=":
        return None, (parse_datetime_string(value[2:]), True)
    if value[:1] == ">":
        return (parse_datetime_string(value[1:]), False), None
    if value[:1] == "<":
        return None, (parse_datetime_string(value[1:]), False)

    raise InvalidQuery(f"{value} is not a valid datetime query")


def parse_datetime_value(value: str) -> tuple[ParsedDatetime, ParsedDatetime]:
    result = None

    # A value that only specifies the date (without a time component) should be
    # expanded to an interval that spans the entire day.
    try:
        result = datetime.strptime(value, DATE_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    else:
        return (result, True), (result + timedelta(days=1), False)

    # A value that contains the time should converted to an interval.
    try:
        result = parse_iso_timestamp(value)
    except ValueError:
        try:
            result = parse_unix_timestamp(value)
        except ValueError:
            pass

    if result is None:
        raise InvalidQuery(f"{value} is not a valid datetime query")

    return (result - timedelta(minutes=5), True), (result + timedelta(minutes=6), False)


def parse_datetime_expression(value: str) -> tuple[ParsedDatetime, ParsedDatetime]:
    if value.startswith(("-", "+")):
        return parse_datetime_range(value)
    elif value.startswith((">", "<", "<=", ">=")):
        return parse_datetime_comparison(value)
    else:
        return parse_datetime_value(value)


def get_date_params(value: str, from_field: str, to_field: str) -> dict[str, Union[datetime, bool]]:
    date_from, date_to = parse_datetime_expression(value)
    result: dict[str, Union[datetime, bool]] = {}
    if date_from is not None:
        date_from_value, date_from_inclusive = date_from
        result.update({from_field: date_from_value, f"{from_field}_inclusive": date_from_inclusive})
    if date_to is not None:
        date_to_value, date_to_inclusive = date_to
        result.update({to_field: date_to_value, f"{to_field}_inclusive": date_to_inclusive})
    return result


def parse_team_value(projects: Sequence[Project], value: Sequence[str]) -> Team:
    return Team.objects.filter(
        slug__iexact=value[1:], projectteam__project__in=projects
    ).first() or Team(id=0)


def get_teams_for_users(projects: Sequence[Project], users: Sequence[User]) -> list[Team]:
    user_ids = [u.id for u in users if u is not None]
    teams = Team.objects.filter(
        id__in=OrganizationMemberTeam.objects.filter(
            organizationmember__in=OrganizationMember.objects.filter(
                user_id__in=user_ids, organization_id=projects[0].organization_id
            ),
            is_active=True,
        ).values("team")
    )
    return list(teams)


def parse_actor_value(
    projects: Sequence[Project], value: str, user: RpcUser | User
) -> Union[RpcUser, Team]:
    if value.startswith("#"):
        return parse_team_value(projects, value)
    return parse_user_value(value, user)


def parse_actor_or_none_value(
    projects: Sequence[Project], value: str, user: User
) -> Optional[Union[RpcUser, Team]]:
    if value == "none":
        return None
    return parse_actor_value(projects, value, user)


def parse_user_value(value: str, user: User | RpcUser) -> RpcUser:
    if value == "me":
        if isinstance(user, User):
            return serialize_rpc_user(user)
        return user

    try:
        return user_service.get_by_username(username=value)[0]
    except IndexError:
        # XXX(dcramer): hacky way to avoid showing any results when
        # an invalid user is entered
        return serialize_rpc_user(User(id=0))


class LatestReleaseOrders(Enum):
    DATE = 0
    SEMVER = 1


def get_latest_release(
    projects: Sequence[Project | int],
    environments: Optional[Sequence[Environment]],
    organization_id: Optional[int] = None,
    adopted=False,
) -> Sequence[str]:
    if organization_id is None:
        project = projects[0]
        if isinstance(project, Project):
            organization_id = project.organization_id
        else:
            return []

    # Convert projects to ids so that we can work with them more easily
    project_ids = [getattr(project, "id", project) for project in projects]

    semver_project_ids = []
    date_project_ids = []
    for project_id in project_ids:
        if follows_semver_versioning_scheme(organization_id, project_id):
            semver_project_ids.append(project_id)
        else:
            date_project_ids.append(project_id)

    versions: Set[str] = set()
    versions.update(
        _run_latest_release_query(
            LatestReleaseOrders.SEMVER,
            semver_project_ids,
            environments,
            organization_id,
            adopted=adopted,
        )
    )
    versions.update(
        _run_latest_release_query(
            LatestReleaseOrders.DATE,
            date_project_ids,
            environments,
            organization_id,
            adopted=adopted,
        )
    )

    if not versions:
        raise Release.DoesNotExist()

    return list(sorted(versions))


def _get_release_query_type_sql(query_type: LatestReleaseOrders, last: bool) -> Tuple[str, str]:
    direction = "DESC" if last else "ASC"
    extra_conditions = ""
    if query_type == LatestReleaseOrders.SEMVER:
        rank_order_by = f"major {direction}, minor {direction}, patch {direction}, revision {direction}, CASE WHEN (prerelease = '') THEN 1 ELSE 0 END {direction}, prerelease {direction}, sr.id {direction}"
        extra_conditions += " AND sr.major IS NOT NULL"
    else:
        rank_order_by = f"COALESCE(date_released, date_added) {direction}"
    return rank_order_by, extra_conditions


def _run_latest_release_query(
    query_type: LatestReleaseOrders,
    project_ids: Sequence[int],
    environments: Optional[Sequence[Environment]],
    organization_id: int,
    # Only include adopted releases in the results
    adopted: bool = False,
) -> Sequence[str]:
    if not project_ids:
        return []

    env_join = ""
    env_where = ""
    extra_conditions = ""
    if environments:
        env_join = "INNER JOIN sentry_releaseprojectenvironment srpe on srpe.release_id = sr.id"
        env_where = "AND srpe.environment_id in %s"
        adopted_table_alias = "srpe"
    else:
        adopted_table_alias = "srp"

    if adopted:
        extra_conditions += f" AND {adopted_table_alias}.adopted IS NOT NULL AND {adopted_table_alias}.unadopted IS NULL "

    rank_order_by, query_type_conditions = _get_release_query_type_sql(query_type, True)
    extra_conditions += query_type_conditions

    query = f"""
        SELECT DISTINCT version
        FROM (
            SELECT sr.version, rank() OVER (
                PARTITION BY srp.project_id
                ORDER BY {rank_order_by}
            ) AS rank
            FROM "sentry_release" sr
            INNER JOIN "sentry_release_project" srp ON sr.id = srp.release_id
            {env_join}
            WHERE sr.organization_id = %s
            AND srp.project_id IN %s
            {extra_conditions}
            {env_where}
        ) sr
        WHERE rank = 1
    """
    cursor = connections[router.db_for_read(Release, replica=True)].cursor()
    query_args = [organization_id, tuple(project_ids)]
    if environments:
        query_args.append(tuple(e.id for e in environments))
    cursor.execute(query, query_args)
    return [row[0] for row in cursor.fetchall()]


def get_first_last_release_for_group(
    group: Group,
    query_type: LatestReleaseOrders,
    last: bool,
) -> Release:
    """
    Fetches the first or last release associated with a group. `query_type` determines whether we use semver or date
    ordering to order the releases.
    """
    direction = "DESC" if last else "ASC"
    rank_order_by, extra_conditions = _get_release_query_type_sql(query_type, last)

    query = f"""
        SELECT sr.*
        FROM sentry_release sr
        INNER JOIN (
            SELECT sgr.release_id
            FROM sentry_grouprelease sgr
            WHERE sgr.group_id = %s
            ORDER BY sgr.first_seen {direction}
            -- We limit the number of groupreleases we check here to handle edge cases of groups with 100k+ releases
            LIMIT 1000
        ) sgr ON sr.id = sgr.release_id
        {extra_conditions}
        ORDER BY {rank_order_by}
        LIMIT 1
    """
    result = list(Release.objects.raw(query, [group.id]))
    if not result:
        raise Release.DoesNotExist
    return result[0]


def parse_release(
    value: str,
    projects: Sequence[Project | int],
    environments: Optional[Sequence[Environment]],
    organization_id: Optional[int] = None,
) -> Sequence[str]:
    if value == "latest":
        try:
            return get_latest_release(projects, environments, organization_id)
        except Release.DoesNotExist:
            # Should just get no results here, so return an empty release name.
            return [""]
    else:
        return [value]


numeric_modifiers: Sequence[
    Tuple[str, Callable[[str, Union[int, float]], dict[str, Union[int, float, bool]]]]
] = [
    (
        ">=",
        lambda field, value: {
            f"{field}_lower": value,
            f"{field}_lower_inclusive": True,
        },
    ),
    (
        "<=",
        lambda field, value: {
            f"{field}_upper": value,
            f"{field}_upper_inclusive": True,
        },
    ),
    (
        ">",
        lambda field, value: {
            f"{field}_lower": value,
            f"{field}_lower_inclusive": False,
        },
    ),
    (
        "<",
        lambda field, value: {
            f"{field}_upper": value,
            f"{field}_upper_inclusive": False,
        },
    ),
]


def get_numeric_field_value(
    field: str, raw_value: str, type: Callable[[str], Union[int, float]] = int
) -> dict[str, Union[int, float, bool]]:
    try:
        for modifier, function in numeric_modifiers:
            if raw_value.startswith(modifier):
                return function(field, type(str(raw_value[len(modifier) :])))
        else:
            return {field: type(raw_value)}
    except ValueError:
        msg = f'"{raw_value}" could not be converted to a number.'
        raise InvalidQuery(msg)


def tokenize_query(query: str) -> dict[str, list[str]]:
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
        result["query"] = [format_query(query) for query in query_params["query"]]
    for tag in query_params["tags"]:
        key, value = format_tag(tag)
        result[key].append(value)
    return dict(result)


def format_tag(tag: str) -> tuple[str, str]:
    """
    Splits tags on ':' and removes enclosing quotes and grouping parens if present and
    returns both sides of the split as strings

    Example:
    >>> format_tag('user:foo')
    'user', 'foo'
    >>>format_tag('user:"foo bar"')
    'user', 'foo bar'
    """
    idx = tag.index(":")
    key = remove_surrounding_quotes(tag[:idx].lstrip("("))
    value = remove_surrounding_quotes(tag[idx + 1 :].rstrip(")"))
    return key, value


def remove_surrounding_quotes(text: str) -> str:
    length = len(text)
    if length <= 1:
        return text

    left = 0
    while left <= length / 2:
        if text[left] != '"':
            break
        left += 1

    right = length - 1
    while right >= length / 2:
        if text[right] != '"' or text[right - 1] == "\\":
            break
        right -= 1

    return text[left : right + 1]


def format_query(query: str) -> str:
    """
    Strips enclosing quotes and grouping parens from queries if present.

    Example:
    >>> format_query('"user:foo bar"')
    'user:foo bar'
    """
    return query.strip('"()')


def split_query_into_tokens(query: str) -> Sequence[str]:
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

    Has a companion implementation in static/app/utils/tokenizeSearch.tsx
    """
    tokens = []
    token = ""
    quote_enclosed = False
    quote_type = None
    end_of_prev_word = None
    idx = 0
    while idx < len(query):
        char = query[idx]
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
        if quote_enclosed and char == "\\" and next_char == quote_type:
            if next_char is not None:
                token += next_char
                idx += 1
        idx += 1
    if not token.isspace():
        tokens.append(token.strip(" "))
    return tokens


def parse_query(
    projects: Sequence[Project], query: str, user: User, environments: Sequence[Environment]
) -> dict[str, Any]:
    """| Parses the query string and returns a dict of structured query term values:
    | Required:
    | - tags: dict[str, Union[str, list[str], Any]]: dictionary of tag key-values 'user.id:123'
    | - query: str: the general query portion of the query string
    | Optional:
    | - unassigned: bool: 'is:unassigned'
    | - for_review: bool: 'is:for_review'
    | - linked: bool: 'is:linked'
    | - status: int: 'is:<resolved,unresolved,ignored,muted,reprocessing>'
    | - assigned_to: Optional[Union[User, Team]]: 'assigned:<user or team>'
    | - assigned_or_suggested: Optional[Union[User, Team]]: 'assigned_or_suggested:<user or team>'
    | - bookmarked_by: User: 'bookmarks:<user>'
    | - subscribed_by: User: 'subscribed:<user>'
    | - first_release: Sequence[str]: '<first-release/firstRelease>:1.2.3'
    | - age_from: Union[datetime, bool]: '<age/firstSeen>:-1h'
    | - age_to: Union[datetime, bool]: '<age/firstSeen>:+1h'
    | - last_seen_from: Union[datetime, bool]: 'last_seen/lastSeen:-1h'
    | - last_seen_to: Union[datetime, bool]: 'last_seen/lastSeen:+1h'
    | - date_from: Union[datetime, bool]: 'event.timestamp:-24h'
    | - date_to: Union[datetime, bool]: 'event.timestamp:+0m'
    | - times_seen: Union[int, float]: 'timesSeen:>100'

    :returns: A dict of parsed values from the query.
    """
    # TODO(dcramer): handle query being wrapped in quotes
    tokens = tokenize_query(query)

    results: dict[str, Any] = {"tags": {}, "query": []}
    for key, token_list in tokens.items():
        for value in token_list:
            if key == "query":
                results["query"].append(value)
            elif key == "is":
                if value == "unassigned":
                    results["unassigned"] = True
                elif value == "assigned":
                    results["unassigned"] = False
                elif value == "for_review":
                    results["for_review"] = True
                elif value == "linked":
                    results["linked"] = True
                elif value == "unlinked":
                    results["linked"] = False
                else:
                    try:
                        results["status"] = STATUS_QUERY_CHOICES[value]
                    except KeyError:
                        raise InvalidQuery(f"'is:' had unknown status code '{value}'.")
            elif key == "assigned":
                results["assigned_to"] = parse_actor_or_none_value(projects, value, user)
            elif key == "assigned_or_suggested":
                results["assigned_or_suggested"] = parse_actor_or_none_value(projects, value, user)
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


def convert_user_tag_to_query(key: str, value: str) -> Optional[str]:
    """
    Converts a user tag to a query string that can be used to search for that
    user. Returns None if not a user tag.
    """
    if key == "user" and ":" in value:
        sub_key, value = value.split(":", 1)
        if KEYWORD_MAP.get_key(sub_key, None):
            return 'user.{}:"{}"'.format(sub_key, value.replace('"', '\\"'))
    return None


@dataclass
class SupportedConditions:
    field_name: str
    operators: Optional[FrozenSet[str]] = None


supported_cdc_conditions = [
    SupportedConditions("status", frozenset(["IN"])),
]
supported_cdc_conditions_lookup = {
    condition.field_name: condition for condition in supported_cdc_conditions
}


def validate_cdc_search_filters(search_filters: Optional[Sequence[SearchFilter]]) -> bool:
    """
    Validates whether a set of search filters can be handled by the cdc search backend.
    """
    for search_filter in search_filters or ():
        supported_condition = supported_cdc_conditions_lookup.get(search_filter.key.name)
        if not supported_condition:
            return False
        if (
            supported_condition.operators
            and search_filter.operator not in supported_condition.operators
        ):
            return False
    return True


# Mapping of device class to the store corresponding tag value
DEVICE_CLASS: Dict[str, Set[str]] = {
    "low": {"1"},
    "medium": {"2"},
    "high": {"3"},
}


def map_device_class_level(device_class: str) -> Optional[str]:
    for key, value in DEVICE_CLASS.items():
        if device_class in value:
            return key
    return None
