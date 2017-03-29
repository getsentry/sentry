from __future__ import absolute_import, division, print_function

from collections import defaultdict
from datetime import timedelta

import re
from django.db import DataError
from django.utils import timezone, dateparse

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
        }).order_by('-sort').values_list('version', flat=True).first()
        if value is None:
            return EMPTY
    return value


def get_user_tag(project, key, value):
    # TODO(dcramer): do something with case of multiple matches
    try:
        lookup = EventUser.attr_from_keyword(key)
        euser = EventUser.objects.filter(
            project=project,
            **{lookup: value}
        )[0]
    except (KeyError, IndexError):
        return u'{}:{}'.format(key, value)
    except DataError:
        raise InvalidQuery(u"malformed '{}:' query '{}'.".format(key, value))
    return euser.tag_value


def parse_user_value(value, user):
    if value == 'me':
        return user

    try:
        return find_users(value)[0]
    except IndexError:
        # XXX(dcramer): hacky way to avoid showing any results when
        # an invalid user is entered
        return User(id=0)


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
    result['tags'] = map(format_tag, query_params['tags'])
    return dict(result)


def format_tag(tag):
    '''
    Splits tags on ':' and removes enclosing quotes if present and returns
    returns both sides of the split as strings

    Example:
    >>> format_tag('user:foo')
    'user:foo'
    >>>format_tag('user:"foo bar"')
    'user:foo bar'
    '''
    key, value = tag.split(':', 1)
    key = key.strip('"')
    value = value.strip('"')
    return '{}:{}'.format(key, value)


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


def _assigned_tag(tokenized_tag, dictionary, user, project):
    '''Handles behavior for 'event.timestamp' tags.  Returns mutated dictionary'''
    value = tokenized_tag['value']
    dictionary['assigned_to'] = parse_user_value(value, user)
    return dictionary


def _bookmark_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    dictionary['bookmarked_by'] = parse_user_value(value, user)
    return dictionary


def _subscribed_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    dictionary['subscribed_by'] = parse_user_value(value, user)
    return dictionary


def _event_timestamp_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    operator = tokenized_tag['prefix_operator']
    time_stamp = _parse_timestamp(tokenized_tag)
    if operator:
        inclusitivity = operator in ('>=', '<=')
        bound = 'to' if operator in ('<', '<=') else 'from'
        dictionary['date_{}'.format(bound)] = time_stamp
        dictionary['date_{}_inclusive'.format(bound)] = inclusitivity
    else:
        start_offset = 0 if dateparse.parse_date(value) else 5
        end_offset = 1440 if dateparse.parse_date(value) else 6
        start_time = time_stamp - timedelta(minutes=start_offset)
        end_time = time_stamp + timedelta(minutes=end_offset)
        dictionary['date_to'] = end_time
        dictionary['date_to_inclusive'] = False
        dictionary['date_from'] = start_time
        dictionary['date_from_inclusive'] = True
    return dictionary


def _times_seen(tokenized_tag, dictionary, user, project):
    operator = tokenized_tag['prefix_operator']
    value = tokenized_tag['value']
    if not operator:
        dictionary['times_seen'] = value
        return dictionary
    inclusivity = operator in ('<=', '>=')
    bound = 'lower' if operator in ('>=', '>') else 'upper'
    dictionary['times_seen_{}'.format(bound)] = int(value)
    dictionary['times_seen_{}_inclusive'.format(bound)] = inclusivity
    return dictionary


def _default_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    key = tokenized_tag['key']
    dictionary['tags'][key] = value
    return dictionary


# TODO(dcramer): currently inclusivity is not controllable by the query
# as from date is always inclusive, and to date is always exclusive
def _age_tag(tokenized_tag, dictionary, user, project):
    if tokenized_tag['prefix_operator'] not in ('-', '+'):
        raise InvalidQuery("Malformed Query: '{}'. 'age' tag must have leading '+' or '-' operator e.g. 'age:-24h'".format(tokenized_tag['string']))
    if tokenized_tag['suffix_operator'] not in ('w', 'd', 'h', 'm'):
        raise InvalidQuery("Malformed Query: '{}'. 'age' tag must have trailing time interval operator 'm', 'h', 'd', or 'w' e.g. 'age:-24h'".format(tokenized_tag['string']))
    if not tokenized_tag['value'].__class__.__name__ == 'int':
        raise InvalidQuery("Malformed Query: '{}'. 'age' tag must have integer value 'age:-24h'".format(tokenized_tag['string']))
    operator = tokenized_tag['prefix_operator']
    time_stamp = _parse_timestamp(tokenized_tag)
    inclusivity = operator == '-'
    bound = 'to' if operator == '+' else 'from'
    dictionary['age_{}'.format(bound)] = time_stamp
    dictionary['age_{}_inclusive'.format(bound)] = inclusivity
    return dictionary


def _first_seen_tag(tokenized_tag, dictionary, user, project):
    time_stamp = _parse_timestamp(tokenized_tag)
    operator = tokenized_tag['prefix_operator']
    inclusivity = operator == '-'
    bound = 'to' if operator == '+' else 'from'
    dictionary['first_seen_{}'.format(bound)] = time_stamp
    dictionary['first_seen_{}_inclusive'.format(bound)] = inclusivity
    return dictionary


def _last_seen_tag(tokenized_tag, dictionary, user, project):
    time_stamp = _parse_timestamp(tokenized_tag)
    operator = tokenized_tag['prefix_operator']
    inclusivity = operator == '-'
    bound = 'to' if operator == '+' else 'from'
    dictionary['last_seen_{}'.format(bound)] = time_stamp
    dictionary['last_seen_{}_inclusive'.format(bound)] = inclusivity
    return dictionary


def _active_since_tag(tokenized_tag, dictionary, user, project):
    time_stamp = _parse_timestamp(tokenized_tag)
    operator = tokenized_tag['prefix_operator']
    inclusivity = operator == '-'
    bound = 'to' if operator == '+' else 'from'
    dictionary['active_at_{}'.format(bound)] = time_stamp
    dictionary['active_at_{}_inclusive'.format(bound)] = inclusivity
    return dictionary


def _user_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    key = tokenized_tag['key']
    if ':' in value:
        comp, value = value.split(':', 1)
    elif key.startswith('user.'):
        comp = key.split('.', 1)[1]
    else:
        comp = 'id'
    dictionary['tags']['sentry:user'] = get_user_tag(project, comp, value)
    return dictionary


def _release_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    dictionary['tags']['sentry:release'] = parse_release(project, value)
    return dictionary


def _first_release_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    dictionary['first_release'] = parse_release(project, value)
    return dictionary


def _has_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    if value in ('user', 'release'):
        value = 'sentry:' + value
    dictionary['tags'][value] = ANY
    return dictionary


def _is_tag(tokenized_tag, dictionary, user, project):
    value = tokenized_tag['value']
    if value == 'unassigned':
        dictionary['unassigned'] = True
    elif value == 'assigned':
        dictionary['unassigned'] = False
    else:
        try:
            dictionary['status'] = STATUS_CHOICES[value]
        except KeyError:
            raise InvalidQuery(u"'is:' had unknown status code '{}'.".format(value))
    return dictionary


def tokenize_tag(tag):
    '''
    Parses tag in string format and returns a dictionary of tokens.

    Examples:
    'age:-24h' -> {'value': '24', 'prefix_operator': '-', 'suffix_operator': 'h' 'key': 'age', 'string': 'age:-24h'}
    'event.timestamp:>=2017-01-01' -> {'value': '2017-01-01', 'prefix_operator': '>=', 'suffix_operator': '' 'key': 'event.timestamp', 'string': 'event.timestamp:>=2017-01-01'}
    'user:joe' -> {'value': 'joe', 'prefix_operator': '', 'suffix_operator': '' 'key': 'user', 'string': 'user:joe'}
    '''
    key, value = tag.split(':', 1)
    tags_with_prefix_operators = ('age', 'event.timestamp', 'timesSeen', 'lastSeen', 'activeSince', 'firstSeen')
    tags_with_suffix_operators = ('age', 'activeSince', 'lastSeen', 'firstSeen')
    prefix_operators = ('>', '<', '-', '+')
    suffix_operators = ('m', 'h', 'd', 'w')
    prefix_operator = ''
    suffix_operator = ''
    if key in tags_with_prefix_operators and value[0] in prefix_operators:
        prefix_operator = value[0]
        value = value[1:]
    if prefix_operator and value[0] == '=':
        prefix_operator += '='
        value = value[1:]
    if key in tags_with_suffix_operators and value[-1] in suffix_operators:
        suffix_operator = value[-1]
        value = value[:-1]
    result = {
        'key': key,
        'prefix_operator': prefix_operator,
        'suffix_operator': suffix_operator,
        'value': int(value) if value.isdigit() else value,
        'string': tag
    }
    return result


def _parse_timestamp(tokenized_tag):
    '''
    Returns timestamp from tokenized tag value as datetime object.
    Handles the following timestamp formats:
    '2012-01-01' -> datetime.datetime(2012, 1, 1, 0, 0, 0, tzinfo=<UTC>)
    '2012-01-01T12:34:56' -> datetime.datetime(2012, 1, 1, 12, 34, tzinfo=<UTC>)

    If value is an integer, returns timedelta before current time:
    { 'value': '24', 'suffix_operator': 'h' ->  current time - timedelta(hours=24)
    '''
    value = tokenized_tag['value']
    if value.__class__.__name__ == 'int':
        mins = _scale_time(tokenized_tag)
        time_stamp = timezone.now() - timedelta(minutes=mins)
    elif dateparse.parse_datetime(value):
        time_stamp = dateparse.parse_datetime(value)
    else:
        time_stamp = dateparse.parse_datetime(value + 'T00:00:00')
    return time_stamp.replace(tzinfo=timezone.utc)


def _scale_time(tokenized_tag):
    '''
    Returns tokenized_tag['value'] scaled to minutes based on
    time interval in tokenized_tag['suffix_operator'].
    {'value': '1', 'suffix_operator': 'd' } -> 1440
    '''
    operator = tokenized_tag['suffix_operator']
    minutes = int(tokenized_tag['value'])
    if operator == 'h':
        minutes *= 60
    elif operator == 'd':
        minutes *= 60 * 24
    elif operator == 'w':
        minutes *= 60 * 24 * 7
    return minutes


def to_snake(name):
    '''Converts string to snake_case'''
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def parse_query(project, query, user):
    results = {'tags': {}, 'query': []}
    tokens = tokenize_query(query)
    results['query'] = ' '.join(tokens['query']) if tokens['query'] else ''
    for tag in tokens['tags']:
        tag_tokens = tokenize_tag(tag)
        key = tag_tokens['key']
        selector = to_snake(key).split('.')[0].replace('-', '_')
        action = special_tag_behaviors.get(selector) or _default_tag
        results = action(tag_tokens, results, user, project)
    return results


special_tag_behaviors = {
    'age': _age_tag,
    'event': _event_timestamp_tag,
    'times_seen': _times_seen,
    'assigned': _assigned_tag,
    'bookmarks': _bookmark_tag,
    'subscribed': _subscribed_tag,
    'first_seen': _first_seen_tag,
    'last_seen': _last_seen_tag,
    'active_since': _active_since_tag,
    'user': _user_tag,
    'release': _release_tag,
    'first_release': _first_release_tag,
    'has': _has_tag,
    'is': _is_tag
}
