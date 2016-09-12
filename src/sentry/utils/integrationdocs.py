# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.
from __future__ import absolute_import

import os
import sys
import json
import logging

import sentry

BASE_URL = 'https://docs.sentry.io/hosted/_platforms/{}'

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__),
                                          'integration-docs'))

# We cannot leverage six here, so we need to vendor
# bits that we need.
if sys.version_info[0] == 3:
    def iteritems(d, **kw):
        return iter(d.items(**kw))

    from urllib.request import urlopen

else:
    def iteritems(d, **kw):
        return d.iteritems(**kw)  # NOQA

    from urllib2 import urlopen


"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `sentry repair --with-docs` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""

logger = logging.getLogger('sentry')


def dump_doc(path, data):
    fn = os.path.join(DOC_FOLDER, path + '.json')
    directory = os.path.dirname(fn)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with open(fn, 'wb') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


def load_doc(path):
    if '/' in path:
        return None
    fn = os.path.join(DOC_FOLDER, path + '.json')
    try:
        with open(fn, 'rb') as f:
            return json.load(f)
    except IOError:
        return None


def get_integration_id(platform_id, integration_id):
    if integration_id == '_self':
        return platform_id
    return '{}-{}'.format(platform_id, integration_id)


def sync_docs():
    print('syncing documentation (platform index)')
    body = urlopen(BASE_URL.format('_index.json')).read().decode('utf-8')
    data = json.loads(body)
    platform_list = []
    for platform_id, integrations in iteritems(data['platforms']):
        platform_list.append({
            'id': platform_id,
            'name': integrations['_self']['name'],
            'integrations': [
                {
                    'id': get_integration_id(platform_id, i_id),
                    'name': i_data['name'],
                    'type': i_data['type'],
                    'link': i_data['doc_link'],
                } for i_id, i_data in sorted(
                    iteritems(integrations),
                    key=lambda x: x[1]['name']
                )
            ],
        })

    platform_list.sort(key=lambda x: x['name'])

    dump_doc('_platforms', {'platforms': platform_list})

    for platform_id, platform_data in iteritems(data['platforms']):
        for integration_id, integration in iteritems(platform_data):
            sync_integration_docs(platform_id, integration_id,
                                  integration['details'])


def sync_integration_docs(platform_id, integration_id, path):
    print('  syncing documentation for %s.%s integration' % (
        platform_id, integration_id
    ))

    data = json.load(urlopen(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(key, {
        'id': key,
        'name': data['name'],
        'html': data['body'],
        'link': data['doc_link'],
    })
