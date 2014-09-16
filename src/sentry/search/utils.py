from __future__ import absolute_import, division, print_function


def parse_query(query):
    # TODO(dcramer): make this better
    tokens = query.split(' ')

    results = {'tags': {}, 'query': []}
    for token in tokens:
        if ':' in token:
            key, value = token.split(':', 1)
            results['tags'][key] = value
        else:
            results['query'].append(token)

    results['query'] = ' '.join(results['query'])

    return results
