from __future__ import absolute_import, division, print_function

from sentry.constants import STATUS_CHOICES
from sentry.models import EventUser, User
from sentry.utils.auth import find_users


def get_user_tag(project, key, value):
    if key == 'id':
        lookup = 'ident'
    elif key == 'ip':
        lookup = 'ip_address'
    else:
        lookup = key

    # TODO(dcramer): do something with case of multiple matches
    try:
        euser = EventUser.objects.filter(
            project=project,
            **{lookup: value}
        )[0]
    except IndexError:
        return '{}:{}'.format(key, value)

    return euser.tag_value


def parse_query(project, query, user):
    # TODO(dcramer): handle query being wrapped in quotes
    tokens = query.split(' ')

    results = {'tags': {}, 'query': []}

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

        if key == 'is':
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
        elif key.startswith('user.'):
            results['tags']['sentry:user'] = get_user_tag(
                project, key.split('.', 1)[1], value)
        else:
            results['tags'][key] = value

    results['query'] = ' '.join(results['query'])

    return results
