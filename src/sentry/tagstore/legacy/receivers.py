"""
sentry.tagstore.legacy.receivers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry.signals import buffer_incr_complete
from sentry.receivers.releases import ensure_release_exists

from .models import TagValue, GroupTagValue


@buffer_incr_complete.connect(sender=TagValue, weak=False)
def record_project_tag_count(filters, created, **kwargs):
    from sentry import tagstore

    if not created:
        return

    # TODO(dcramer): remove in 7.6.x
    project_id = filters.get('project_id')
    if not project_id:
        project_id = filters['project'].id

    tagstore.incr_tag_key_values_seen(project_id, filters['key'])


@buffer_incr_complete.connect(sender=GroupTagValue, weak=False)
def record_group_tag_count(filters, created, extra, **kwargs):
    from sentry import tagstore

    if not created:
        return

    project_id = extra.get('project_id')
    if not project_id:
        project_id = extra['project']

    group_id = filters['group_id']

    tagstore.incr_group_tag_key_values_seen(project_id, group_id, filters['key'])


post_save.connect(
    ensure_release_exists, sender=TagValue, dispatch_uid="ensure_release_exists", weak=False
)
