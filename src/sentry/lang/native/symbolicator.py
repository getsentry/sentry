from __future__ import absolute_import

import six

import time
import logging

from django.conf import settings
from django.core.urlresolvers import reverse

from requests.exceptions import RequestException

from sentry import options
from sentry.auth.system import get_system_token
from sentry.net.http import Session
from sentry.tasks.store import SymbolicatorRetry

MAX_ATTEMPTS = 3

logger = logging.getLogger(__name__)


def run_symbolicator(stacktraces, modules, project, arch, signal, request_id=None):
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

    request = {
        'meta': {
            'signal': signal,
            'arch': arch or 'unknown',
            'scope': six.text_type(project.id),
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
            'request_id': request_id,
            'timeout': 5,
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
                rv = sess.post(url, json=request)
                rv.raise_for_status()
                json = rv.json()
                if json['status'] == 'pending':
                    raise SymbolicatorRetry(retry_after=json['retry_after'])
                elif json['status'] == 'completed':
                    return rv.json()
                else:
                    raise ValueError("Unexpected status: %s" % json['status'])

            except (IOError, RequestException):
                attempts += 1
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact symbolicator', exc_info=True)
                    return

                time.sleep(wait)
                wait *= 2.0
