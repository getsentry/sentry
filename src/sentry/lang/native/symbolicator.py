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

    url = '%s/symbolicate' % settings.SENTRY_SYMBOLICATOR_URL
    project_id = six.text_type(project.id)

    request_id = default_cache.get(request_id_cache_key)
    if request_id:
        request = {
            'meta': {
                'scope': project_id,
            },
            'request': {
                'request_id': request_id,
                'timeout': SYMBOLICATOR_TIMEOUT,
            }
        }
    else:
        request = {
            'meta': {
                'signal': signal,
                'scope': project_id,
            },
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

    sess = Session()

    attempts = 0
    wait = 0.5

    with sess:
        while 1:
            try:
                rv = sess.post(
                    url,
                    json=request,
                    headers={
                        "X-Sentry-Project-Id": project_id
                    }
                )
                rv.raise_for_status()
                json = rv.json()
                metrics.incr('events.symbolicator.status.%s' % json['status'], tags={
                    'project_id': project_id
                })
                if json['status'] == 'pending':
                    default_cache.set(
                        request_id_cache_key,
                        json['request_id'],
                        REQUEST_CACHE_TIMEOUT)
                    raise RetrySymbolication(retry_after=json['retry_after'])
                elif json['status'] == 'completed':
                    default_cache.delete(request_id_cache_key)
                    return rv.json()
                elif json['status'] == 'unknown_request':
                    default_cache.delete(request_id_cache_key)
                    raise RetrySymbolication(retry_after=0)
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
