from __future__ import absolute_import, print_function

from sentry.tasks.base import instrumented_task

BASE_URL = 'https://docs.getsentry.com/hosted/_platforms/{}'


def get_integration_id(platform_id, integration_id):
    if integration_id == '_self':
        return platform_id
    return '{}-{}'.format(platform_id, integration_id)


@instrumented_task(name='sentry.tasks.sync_docs', queue='update')
def sync_docs():
    from sentry import http, options

    session = http.build_session()

    data = session.get(BASE_URL.format('_index.json')).json()
    platform_list = []
    for platform_id, integrations in data['platforms'].iteritems():
        platform_list.append({
            'id': platform_id,
            'name': integrations['_self']['name'],
            'integrations': [
                {
                    'id': get_integration_id(platform_id, i_id),
                    'name': i_data['name'],
                    'type': i_data['type'],
                    'link': i_data['doc_link'],
                } for i_id, i_data in integrations.iteritems()
            ],
        })

    options.set('sentry:docs', {'platforms': platform_list})

    for platform_id, platform_data in data['platforms'].iteritems():
        for integration_id, integration in platform_data.iteritems():
            sync_integration(platform_id, integration_id, integration['details'])


def sync_integration(platform_id, integration_id, path):
    from sentry import http, options

    session = http.build_session()

    data = session.get(BASE_URL.format(path)).json()

    key = get_integration_id(platform_id, integration_id)
    options.set('sentry:docs:{}'.format(key), {
        'id': key,
        'name': data['name'],
        'html': data['body'],
        'link': data['doc_link'],
    })
