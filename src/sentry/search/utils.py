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
            project=project,
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

reserved_tag_names = frozenset([
    'query',
    'is',
    'assigned',
    'bookmarks',
    'subscribed',
    'first-release',
    'release',
    'level',
    'user',
    'user.id',
    'user.ip',
    'has',
    'age',
    'last_seen',
    'environment',
    'browser',
    'device',
    'os',
    'os.name',
    'url',
    'event.timestamp'])


def tokenize_query(query):
    """
    Tokenizes a standard Sentry search query.

    >>> query = 'is:resolved foo bar tag:value'
    >>> tokenize_query(query)
    {
        'is': ['resolved'],
        'query': ['foo', 'bar'],
        'tag': ['value'],
    }
    """
    results = defaultdict(list)

    tokens = query.split(' ')
    tokens_iter = iter(tokens)
    for token in tokens_iter:
        # ignore empty tokens
        if not token:
            continue

        if ':' not in token:
            results['query'].append(token)
            continue

        # this handles quoted string, and is duplicated below
        if token[0] == '"':
            nvalue = token
            while nvalue[-1] != '"':
                try:
                    nvalue = six.next(tokens_iter)
                except StopIteration:
                    break
                token = '%s %s' % (token, nvalue)

            if token[-1] == '"':
                token = token[1:-1]
            else:
                token = token[1:]
            results['query'].append(token)
            continue

        key, value = token.split(':', 1)
        if not value:
            results['query'].append(token)
            if key in reserved_tag_names:
                raise InvalidQuery(u"query term '{}:' found no arguments. (Terms are space delimited)".format(key))
            continue

        if value[0] == '"':
            nvalue = value
            while nvalue[-1] != '"':
                try:
                    nvalue = six.next(tokens_iter)
                except StopIteration:
                    break
                value = '%s %s' % (value, nvalue)

            if value[-1] == '"':
                value = value[1:-1]
            else:
                value = value[1:]
        results[key].append(value)
    return dict(results)


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
            elif key == 'first-release':
                results['first_release'] = parse_release(project, value)
            elif key == 'release':
                results['tags']['sentry:release'] = parse_release(project, value)
            elif key == 'user':
                if ':' in value:
                    comp, value = value.split(':', 1)
                else:
                    comp = 'id'
                results['tags']['sentry:user'] = get_user_tag(
                    project, comp, value)
            elif key == 'has':
                if value == 'user':
                    value = 'sentry:user'
                elif value == 'release':
                    value = 'sentry:release'
                results['tags'][value] = ANY
            elif key == 'age':
                results.update(get_date_params(value, 'age_from', 'age_to'))
            elif key == 'last_seen':
                results.update(get_date_params(value, 'last_seen_from', 'last_seen_to'))
            elif key.startswith('user.'):
                results['tags']['sentry:user'] = get_user_tag(
                    project, key.split('.', 1)[1], value)
            elif key == 'event.timestamp':
                results.update(get_date_params(value, 'date_from', 'date_to'))
            else:
                results['tags'][key] = value

    results['query'] = ' '.join(results['query'])

    return results
