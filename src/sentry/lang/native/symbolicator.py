from __future__ import absolute_import

import six

import time
import logging

from django.core.urlresolvers import reverse

from requests.exceptions import RequestException

from sentry import options
from sentry.auth.system import get_system_token
from sentry.cache import default_cache
from sentry.utils import metrics
from sentry.net.http import Session
from sentry.tasks.store import RetrySymbolication

MAX_ATTEMPTS = 3
REQUEST_CACHE_TIMEOUT = 3600
SYMBOLICATOR_TIMEOUT = 5

logger = logging.getLogger(__name__)


def run_symbolicator(stacktraces, modules, project, arch, signal, request_id_cache_key):
    internal_url_prefix = options.get('system.internal-url-prefix') \
        or options.get('system.url-prefix')

    assert internal_url_prefix
    sentry_source_url = '%s%s' % (
        internal_url_prefix.rstrip('/'),
        reverse('sentry-api-0-dsym-files', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug
        })
    )

    symbolicator_options = options.get('symbolicator.options')
    base_url = symbolicator_options['url'].rstrip('/')
    assert base_url

    project_id = six.text_type(project.id)
    request_id = default_cache.get(request_id_cache_key)
    sess = Session()

    attempts = 0
    wait = 0.5

    with sess:
        while 1:
            try:

                if request_id:
                    rv = _poll_symbolication_task(
                        sess=sess, base_url=base_url,
                        request_id=request_id
                    )
                else:
                    rv = _create_symbolication_task(
                        sess=sess, base_url=base_url,
                        project_id=project_id, sentry_source_url=sentry_source_url,
                        signal=signal, stacktraces=stacktraces, modules=modules
                    )

                metrics.incr('events.symbolicator.status.%s' % rv.status_code, tags={
                    'project_id': project_id
                })

                if rv.status_code == 404 and request_id:
                    default_cache.delete(request_id_cache_key)
                    request_id = None
                    continue
                elif rv.status_code == 503:
                    raise RetrySymbolication(retry_after=10)

                rv.raise_for_status()
                json = rv.json()
                metrics.incr(
                    'events.symbolicator.response.%s' % json['status'],
                    tags={'project_id': project_id}
                )

                if json['status'] == 'pending':
                    default_cache.set(
                        request_id_cache_key,
                        json['request_id'],
                        REQUEST_CACHE_TIMEOUT)
                    raise RetrySymbolication(retry_after=json['retry_after'])
                elif json['status'] == 'completed':
                    default_cache.delete(request_id_cache_key)
                    return rv.json()
                else:
                    logger.error("Unexpected status: %s", json['status'])
                    default_cache.delete(request_id_cache_key)
                    return

            except (IOError, RequestException):
                attempts += 1
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact symbolicator', exc_info=True)
                    default_cache.delete(request_id_cache_key)
                    return

                time.sleep(wait)
                wait *= 2.0


def _poll_symbolication_task(sess, base_url, request_id):
    url = '{base_url}/requests/{request_id}?timeout={timeout}'.format(
        base_url=base_url,
        request_id=request_id,
        timeout=SYMBOLICATOR_TIMEOUT,
    )
    return sess.get(url)


def _create_symbolication_task(sess, base_url, project_id,
                               sentry_source_url, signal, stacktraces, modules):
    request = {
        'signal': signal,
        'sources': [
            {
                'type': 'sentry',
                'id': '__sentry_internal__',
                'url': sentry_source_url,
                'token': get_system_token(),
            },
            {
                'type': 'http',
                'id': 'microsoft',
                'layout': 'symstore',
                'filetypes': ['pdb', 'pe'],
                'url': 'https://msdl.microsoft.com/download/symbols/',
                'is_public': True,
            }
        ],
        'request': {
            'timeout': SYMBOLICATOR_TIMEOUT,
        },
        'stacktraces': stacktraces,
        'modules': modules,
    }
    url = '{base_url}/symbolicate?timeout={timeout}&scope={scope}'.format(
        base_url=base_url,
        timeout=SYMBOLICATOR_TIMEOUT,
        scope=project_id,
    )
    return sess.post(url, json=request)
