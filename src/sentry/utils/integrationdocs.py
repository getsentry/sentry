# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.
from __future__ import absolute_import

import os
import sys
import json
import logging
import pickle

import sentry


BASE_URL = 'https://docs.sentry.io/_platforms/{}'

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.environ.get('INTEGRATION_DOC_FOLDER') or os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), 'integration-docs'))

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


def echo(what):
    sys.stdout.write(what)
    sys.stdout.write('\n')
    sys.stdout.flush()


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
    echo('syncing documentation (platform index)')
    body = urlopen(BASE_URL.format('_index.json')).read().decode('utf-8')
    data = json.loads(body)
    platform_list = []
    python_platforms = []
    for platform_id, integrations in iteritems(data['platforms']):
        platform_list.append(
            {
                'id':
                platform_id,
                'name':
                integrations['_self']['name'],
                'integrations': [
                    {
                        'id': get_integration_id(platform_id, i_id),
                        'name': i_data['name'],
                        'type': i_data['type'],
                        'link': i_data['doc_link'],
                    }
                    for i_id, i_data in sorted(iteritems(integrations), key=lambda x: x[1]['name'])
                ],
            }
        )

    platform_list.sort(key=lambda x: x['name'])

    dump_doc('_platforms', {'platforms': platform_list})

    for platform_id, platform_data in iteritems(data['platforms']):
        for integration_id, integration in iteritems(platform_data):
            sync_integration_docs(platform_id, integration_id, integration['details'])
            python_platforms.append(get_integration_id(platform_id, integration_id))

    # create python platform constants
    __sync_platform_types(python_platforms)


def __sync_platform_types(platforms):
    """
    Updating existing platform types whenever docs are synced
    """
    # Cannot use six here
    valid_platforms = set(platform for platform in platforms)

    echo("updatng platform constants")
    with open('platform-constants.txt', 'w') as file:
        pickle.dump(valid_platforms, file)


def get_platform_types():
    try:
        with open('platform-constants.txt', 'r') as file:
            return pickle.load(file)
    except BaseException:
        # Fall back onto a hardcoded version of the file.
        # Alternatively the docs could be built instead
        # Actually.... when are these docs typically built exactly? I'm calling
        # sentry repair --with-docs
        return set([
            u'java-log4j2', u'node', u'go-http', u'php-symfony2', u'python-rq',
            u'cocoa', u'objc', u'python-pyramid', u'java-logging', u'csharp',
            u'go', u'java-logback', u'php-monolog', u'java', u'javascript-vue',
            u'ruby', u'javascript-angular', u'java-android', u'python-flask',
            u'python-pylons', u'python-bottle', u'python-tornado', u'javascript',
            u'java-appengine', u'python-django', u'python', u'javascript-backbone',
            u'javascript-ember', u'node-koa', u'javascript-electron', u'elixir',
            u'java-log4j', u'php', u'swift', u'ruby-rails', u'ruby-rack', u'node-express',
            u'php-laravel', u'node-connect', u'javascript-react', u'javascript-angularjs',
            u'python-celery'
        ])


def sync_integration_docs(platform_id, integration_id, path):
    echo('  syncing documentation for %s.%s integration' % (platform_id, integration_id))

    data = json.load(urlopen(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(
        key, {
            'id': key,
            'name': data['name'],
            'html': data['body'],
            'link': data['doc_link'],
        }
    )
