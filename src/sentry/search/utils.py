from __future__ import absolute_import, division, print_function

from collections import defaultdict
from datetime import datetime, timedelta

import six
from django.db import DataError
from django.utils import timezone

from sentry.constants import STATUS_CHOICES
from sentry.models import EventUser, Release, User
from sentry.search.base import ANY, EMPTY
from sentry.utils.auth import find_users


class InvalidQuery(Exception):
    pass


def parse_release(project, value):
    # TODO(dcramer): add environment support
    if value == 'latest':
        value = Release.objects.filter(
            organization_id=project.organization_id,
            projects=project,
        ).extra(select={
            'sort': 'COALESCE(date_released, date_added)',
        }).order_by('-sort').values_list(
            'version', flat=True
        ).first()
        if value is None:
            return EMPTY
    return value


def get_user_tag(project, key, value):
    # TODO(dcramer): do something with case of multiple matches
    try:
        lookup = EventUser.attr_from_keyword(key)
        euser = EventUser.objects.filter(
            project_id=project.id, **{lookup: value})[0]
    except (KeyError, IndexError):
        return u'{}:{}'.format(key, value)
    except DataError:
        raise InvalidQuery(u"malformed '{}:' query '{}'.".format(key, value))
    return euser.tag_value


def parse_datetime_range(value):
    try:
        flag, count, interval = value[0], int(value[1:-1]), value[-1]
    except (ValueError, TypeError, IndexError):
        raise InvalidQuery(u'{} is not a valid datetime query'.format(value))

    if flag not in ('+', '-'):
        raise InvalidQuery(u'{} is not a valid datetime query'.format(value))

    if interval == 'h':
        delta = timedelta(hours=count)
    elif interval == 'w':
        delta = timedelta(days=count * 7)
    elif interval == 'd':
        delta = timedelta(days=count)
    elif interval == 'm':
        delta = timedelta(minutes=count)
    else:
        raise InvalidQuery(u'{} is not a valid datetime query'.format(value))

    if flag == '-':
        return (timezone.now() - delta, None)
    else:
        return (None, timezone.now() - delta)


def parse_datetime_comparison(value):
    # TODO(dcramer): currently inclusitivity is not controllable by the query
    # as from date is always inclusive, and to date is always exclusive
    if value[:2] in ('>=', '=>'):
        return (parse_datetime_value(value[2:])[0], None)
    if value[:2] in ('<=', '=<'):
        return (None, parse_datetime_value(value[2:])[0])
    if value[:1] in ('>'):
        return (parse_datetime_value(value[1:])[0], None)
    if value[:1] in ('<'):
        return (None, parse_datetime_value(value[1:])[0])
    if value[0] == '=':
        return parse_datetime_value(value[1:])
    raise InvalidQuery(u'{} is not a valid datetime query'.format(value))


def parse_datetime_value(value):
    try:
        return _parse_datetime_value(value)
    except (ValueError, IndexError):
        raise InvalidQuery(u'{} is not a valid datetime query'.format(value))


def _parse_datetime_value(value):
    # this one is fuzzy, and not entirely correct
    if value.startswith(('-', '+')):
        return parse_datetime_range(value)

    # timezones are not supported and are assumed UTC
    if value[-1] == 'Z':
        value = value[:-1]

    value_len = len(value)
    if value_len in (8, 10):
        value = datetime.strptime(value, '%Y-%m-%d').replace(
            tzinfo=timezone.utc,
        )
        return [value, value + timedelta(days=1)]
    elif value[4] == '-':
        try:
            value = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S').replace(
                tzinfo=timezone.utc,
            )
        except ValueError:
            value = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%f').replace(
                tzinfo=timezone.utc,
            )
    else:
        value = datetime.utcfromtimestamp(float(value)).replace(
            tzinfo=timezone.utc,
        )
    return [value - timedelta(minutes=5), value + timedelta(minutes=6)]


def parse_datetime_expression(value):
    # result must be (from inclusive, to exclusive)
    if value.startswith(('-', '+')):
        return parse_datetime_range(value)

    if value.startswith(('>', '<', '=', '<=', '>=')):
        return parse_datetime_comparison(value)

    return parse_datetime_value(value)


def parse_user_value(value, user):
    if value == 'me':
        return user

    try:
        return find_users(value)[0]
    except IndexError:
        # XXX(dcramer): hacky way to avoid showing any results when
        # an invalid user is entered
        return User(id=0)


def get_date_params(value, from_field, to_field):
    date_from, date_to = parse_datetime_expression(value)
    result = {}
    if date_from:
        result.update({
            from_field: date_from,
            '{}_inclusive'.format(from_field): True,
        })
    if date_to:
        result.update({
            to_field: date_to,
            '{}_inclusive'.format(to_field): False,
        })
    return result


numeric_modifiers = [
    (
        '>=', lambda field, value: {
            '{}_lower'.format(field): value,
            '{}_lower_inclusive'.format(field): True, }
    ),
    (
        '<=', lambda field, value: {
            '{}_upper'.format(field): value,
            '{}_upper_inclusive'.format(field): True, }
    ),
    (
        '>', lambda field, value: {
            '{}_lower'.format(field): value,
            '{}_lower_inclusive'.format(field): False, }
    ),
    (
        '<', lambda field, value: {
            '{}_upper'.format(field): value,
            '{}_upper_inclusive'.format(field): False, }
    ),
]


def get_numeric_field_value(field, raw_value, type=int):
    for modifier, function in numeric_modifiers:
        if raw_value.startswith(modifier):
            return function(
                field,
                type(raw_value[len(modifier):]),
            )
    else:
        return {
            field: type(raw_value),
        }


reserved_tag_names = frozenset(
    [
        'query',
        'is',
        'assigned',
        'bookmarks',
        'subscribed',
        'first-release',
        'firstRelease',
        'release',
        'level',
        'user',
        'user.id',
        'user.ip',
        'has',
        'age',
        'firstSeen',
        'activeSince',
        'last_seen',
        'lastSeen',
        'environment',
        'browser',
        'device',
        'os',
        'app',
        'os.name',
        'url',
        'event.timestamp'
        'timesSeen',
    ]
)


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
    """
    result = defaultdict(list)
    query_params = defaultdict(list)
    tokens = split_query_into_tokens(query)
    for token in tokens:
        state = 'query'
        for idx, char in enumerate(token):
            next_char = token[idx + 1] if idx < len(token) - 1 else None
            if idx == 0 and char in ('"', "'"):
                break
            if char == ':':
                if next_char in (':', ' '):
                    state = 'query'
                else:
                    state = 'tags'
                break
        query_params[state].append(token)

    result['query'] = map(format_query, query_params['query'])
    for tag in query_params['tags']:
        key, value = format_tag(tag)
        result[key].append(value)
    return dict(result)


def format_tag(tag):
    '''
    Splits tags on ':' and removes enclosing quotes if present and returns
    returns both sides of the split as strings

    Example:
    >>> format_tag('user:foo')
    'user', 'foo'
    >>>format_tag('user:"foo bar"'')
    'user', 'foo bar'
    '''
    idx = tag.index(':')
    key = tag[:idx].strip('"')
    value = tag[idx + 1:].strip('"')
    return key, value


def format_query(query):
    '''
    Strips enclosing quotes from queries if present.

    Example:
    >>> format_query('"user:foo bar"')
    'user:foo bar'
    '''
    return query.strip('"')


def split_query_into_tokens(query):
    '''
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
    '''
    tokens = []
    token = ''
    quote_enclosed = False
    quote_type = None
    end_of_prev_word = None
    for idx, char in enumerate(query):
        next_char = query[idx + 1] if idx < len(query) - 1 else None
        token += char
        if next_char and not char.isspace() and next_char.isspace():
            end_of_prev_word = char
        if char.isspace() and not quote_enclosed and end_of_prev_word != ':':
            if not token.isspace():
                tokens.append(token.strip(' '))
                token = ''
        if char in ("'", '"'):
            if not quote_enclosed or quote_type == char:
                quote_enclosed = not quote_enclosed
                if quote_enclosed:
                    quote_type = char
    if not token.isspace():
        tokens.append(token.strip(' '))
    return tokens


def parse_query(project, query, user):
    # TODO(dcramer): handle query being wrapped in quotes
    tokens = tokenize_query(query)

    results = {'tags': {}, 'query': []}
    for key, token_list in six.iteritems(tokens):
        for value in token_list:
            if key == 'query':
                results['query'].append(value)
            elif key == 'is':
                if value == 'unassigned':
                    results['unassigned'] = True
                elif value == 'assigned':
                    results['unassigned'] = False
                else:
                    try:
                        results['status'] = STATUS_CHOICES[value]
                    except KeyError:
                        raise InvalidQuery(u"'is:' had unknown status code '{}'.".format(value))
            elif key == 'assigned':
                results['assigned_to'] = parse_user_value(value, user)
            elif key == 'bookmarks':
                results['bookmarked_by'] = parse_user_value(value, user)
            elif key == 'subscribed':
                results['subscribed_by'] = parse_user_value(value, user)
            elif key in ('first-release', 'firstRelease'):
                results['first_release'] = parse_release(project, value)
            elif key == 'release':
                results['tags']['sentry:release'] = parse_release(project, value)
            elif key == 'dist':
                results['tags']['sentry:dist'] = value
            elif key == 'user':
                if ':' in value:
                    comp, value = value.split(':', 1)
                else:
                    comp = 'id'
                results['tags']['sentry:user'] = get_user_tag(project, comp, value)
            elif key == 'has':
                if value == 'user':
                    value = 'sentry:user'
                elif value == 'release':
                    value = 'sentry:release'
                results['tags'][value] = ANY
            elif key in ('age', 'firstSeen'):
                results.update(get_date_params(value, 'age_from', 'age_to'))
            elif key in ('last_seen', 'lastSeen'):
                results.update(get_date_params(value, 'last_seen_from', 'last_seen_to'))
            elif key == 'activeSince':
                results.update(get_date_params(value, 'active_at_from', 'active_at_to'))
            elif key.startswith('user.'):
                results['tags']['sentry:user'] = get_user_tag(project, key.split('.', 1)[1], value)
            elif key == 'event.timestamp':
                results.update(get_date_params(value, 'date_from', 'date_to'))
            elif key == 'timesSeen':
                results.update(get_numeric_field_value('times_seen', value))
            else:
                results['tags'][key] = value

    results['query'] = ' '.join(results['query'])

    return results
