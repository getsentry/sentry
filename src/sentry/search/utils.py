from __future__ import absolute_import, division, print_function

from collections import defaultdict
from datetime import timedelta
from django.utils import timezone

from sentry.constants import STATUS_CHOICES
from sentry.models import EventUser, User
from sentry.utils.auth import find_users


class InvalidQuery(Exception):
    pass


def get_user_tag(project, key, value):
    # TODO(dcramer): do something with case of multiple matches
    try:
        lookup = EventUser.attr_from_keyword(key)
        euser = EventUser.objects.filter(
            project=project,
            **{lookup: value}
        )[0]
    except (KeyError, IndexError):
        return '{}:{}'.format(key, value)

    return euser.tag_value


def parse_simple_range(value):
    try:
        flag, count, interval = value[0], int(value[1:-1]), value[-1]
    except (ValueError, TypeError):
        # TODO(dcramer): propagate errors
        raise InvalidQuery('{} is not a valid range query'.format(value))

    if flag not in ('+', '-'):
        raise InvalidQuery('{} is not a valid range query'.format(value))

    if interval == 'h':
        return flag, timedelta(hours=count)
    elif interval == 'd':
        return flag, timedelta(days=count)
    elif interval == 'm':
        return flag, timedelta(minutes=count)
    else:
        raise InvalidQuery('{} is not a valid range query'.format(value))


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

        key, value = token.split(':', 1)
        if not value:
            results['query'].append(token)
            continue

        if value[0] == '"':
            nvalue = value
            while nvalue[-1] != '"':
                try:
                    nvalue = tokens_iter.next()
                except StopIteration:
                    break
                value = '%s %s' % (value, nvalue)

            if value.endswith('"'):
                value = value[1:-1]
            else:
                value = value[1:]
        results[key].append(value)
    return dict(results)


def parse_query(project, query, user):
    # TODO(dcramer): handle query being wrapped in quotes
    tokens = tokenize_query(query)

    results = {'tags': {}, 'query': []}

    for key, token_list in tokens.iteritems():
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
                        pass
            elif key == 'assigned':
                if value == 'me':
                    results['assigned_to'] = user
                else:
                    try:
                        results['assigned_to'] = find_users(value)[0]
                    except IndexError:
                        # XXX(dcramer): hacky way to avoid showing any results when
                        # an invalid user is entered
                        results['assigned_to'] = User(id=0)
            elif key == 'bookmarks':
                if value == 'me':
                    results['bookmarked_by'] = user
                else:
                    try:
                        results['bookmarked_by'] = find_users(value)[0]
                    except IndexError:
                        # XXX(dcramer): hacky way to avoid showing any results when
                        # an invalid user is entered
                        results['bookmarked_by'] = User(id=0)
            elif key == 'first-release':
                results['first_release'] = value
            elif key == 'release':
                results['tags']['sentry:release'] = value
            elif key == 'user':
                if ':' in value:
                    comp, value = value.split(':', 1)
                else:
                    comp = 'id'
                results['tags']['sentry:user'] = get_user_tag(
                    project, comp, value)
            elif key == 'age':
                flag, offset = parse_simple_range(value)
                date_value = timezone.now() - offset
                if flag == '+':
                    results['age_date_to'] = date_value
                elif flag == '-':
                    results['age_date_from'] = date_value
            elif key.startswith('user.'):
                results['tags']['sentry:user'] = get_user_tag(
                    project, key.split('.', 1)[1], value)
            else:
                results['tags'][key] = value

    results['query'] = ' '.join(results['query'])

    return results
