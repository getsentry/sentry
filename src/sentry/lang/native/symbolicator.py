from __future__ import absolute_import

import six

import time
import logging

from django.conf import settings
from django.core.urlresolvers import reverse

from requests.exceptions import RequestException

from sentry import options
from sentry.cache import default_cache
from sentry.utils import metrics
from sentry.auth.system import get_system_token
from sentry.net.http import Session
from sentry.tasks.store import RetrySymbolication

MAX_ATTEMPTS = 3
REQUEST_CACHE_TIMEOUT = 3600
SYMBOLICATOR_TIMEOUT = 5

logger = logging.getLogger(__name__)


def run_symbolicator(stacktraces, modules, project, arch, signal, request_id_cache_key):
    self_url_prefix = options.get('system.url-prefix')
    assert self_url_prefix
    self_bucket_url = '%s%s' % (
        self_url_prefix.rstrip('/'),
        reverse('sentry-api-0-dsym-files', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug
        })
    )

    project_id = six.text_type(project.id)
    request_id = default_cache.get(request_id_cache_key)
    sess = Session()

    attempts = 0
    wait = 0.5

    with sess:
        while 1:
            try:
                rv = _do_send_request(
                    sess=sess,
                    request_id=request_id,
                    project_id=project_id,
                    self_bucket_url=self_bucket_url,
                    signal=signal,
                    stacktraces=stacktraces,
                    modules=modules
                )

                metrics.incr('events.symbolicator.status.%s' % rv.status_code, tags={
                    'project_id': project_id
                })

                if rv.status_code == 404 and request_id:
                    default_cache.delete(request_id_cache_key)
                    raise RetrySymbolication(retry_after=0)
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


def _do_send_request(sess, request_id, project_id, self_bucket_url, signal,
                     stacktraces, modules):
    if request_id:
        url = '{base}/requests/{request_id}?timeout={timeout}'.format(
            base=settings.SENTRY_SYMBOLICATOR_URL,
            request_id=request_id,
            timeout=SYMBOLICATOR_TIMEOUT,
        )
        rv = sess.get(url)
    else:
        request = {
            'signal': signal,
            'sources': [
                {
                    "type": "sentry",
                    "id": "sentry-project-difs",
                    "url": self_bucket_url,
                    "token": get_system_token()
                },
                {
                    "type": "http",
                    "id": "microsoft",
                    "layout": "symstore",
                    "filetypes": ["pdb", "pe"],
                    "url": "https://msdl.microsoft.com/download/symbols/",
                    "is_public": True,
                }
            ],
            'request': {
                'timeout': SYMBOLICATOR_TIMEOUT,
            },
            'threads': stacktraces,
            'modules': modules,
        }
        url = '{base}/symbolicate?timeout={timeout}&scope={scope}'.format(
            base=settings.SENTRY_SYMBOLICATOR_URL,
            timeout=SYMBOLICATOR_TIMEOUT,
            scope=project_id,
        )
        rv = sess.post(url, json=request)

    return rv
