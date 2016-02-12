"""
sentry.tasks.beacon
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import json
import logging
import sentry

from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from hashlib import sha1
from uuid import uuid4

from sentry.app import tsdb
from sentry.http import safe_urlopen, safe_urlread
from sentry.tasks.base import instrumented_task
from sentry.debug.utils.packages import get_all_package_versions

BEACON_URL = 'https://getsentry.com/remote/beacon/'

logger = logging.getLogger('beacon')


@instrumented_task(name='sentry.tasks.send_beacon', queue='update')
def send_beacon():
    """
    Send a Beacon to a remote server operated by the Sentry team.

    See the documentation for more details.
    """
    from sentry import options
    from sentry.models import Broadcast, Organization, Project, Team, User

    if not settings.SENTRY_BEACON:
        logger.info('Not sending beacon (disabled)')
        return

    install_id = options.get('sentry:install-id')
    if not install_id:
        logger.info('Generated installation ID: %s', install_id)
        install_id = sha1(uuid4().hex).hexdigest()
        options.set('sentry:install-id', install_id)

    end = timezone.now()
    events_24h = tsdb.get_sums(
        model=tsdb.models.internal,
        keys=['events.total'],
        start=end - timedelta(hours=24),
        end=end,
    )['events.total']

    payload = {
        'install_id': install_id,
        'version': sentry.get_version(),
        'admin_email': options.get('system.admin-email'),
        'data': {
            # TODO(dcramer): we'd also like to get an idea about the throughput
            # of the system (i.e. events in 24h)
            'users': User.objects.count(),
            'projects': Project.objects.count(),
            'teams': Team.objects.count(),
            'organizations': Organization.objects.count(),
            'events.24h': events_24h,
        },
        'packages': get_all_package_versions(),
    }

    # TODO(dcramer): relay the response 'notices' as admin broadcasts
    try:
        request = safe_urlopen(BEACON_URL, json=payload, timeout=5)
        response = safe_urlread(request)
    except Exception:
        logger.warning('Failed sending beacon', exc_info=True)
        return

    data = json.loads(response)

    if 'version' in data:
        options.set('sentry:latest_version', data['version']['stable'])

    if 'notices' in data:
        upstream_ids = set()
        for notice in data['notices']:
            upstream_ids.add(notice['id'])
            Broadcast.objects.create_or_update(
                upstream_id=notice['id'],
                defaults={
                    'title': notice['title'],
                    'link': notice.get('link'),
                    'message': notice['message'],
                }
            )

        Broadcast.objects.filter(
            upstream_id__isnull=False,
        ).exclude(
            upstream_id__in=upstream_ids,
        ).update(
            is_active=False,
        )
