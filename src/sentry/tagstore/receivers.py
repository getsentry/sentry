"""
sentry.tagstore.receivers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry.signals import buffer_incr_complete
from sentry.receivers.releases import ensure_release_exists


def setup_receivers(tagvalue_model, grouptagvalue_model):
    @buffer_incr_complete.connect(sender=tagvalue_model, weak=False)
    def record_project_tag_count(filters, created, **kwargs):
        from sentry import tagstore

        if not created:
            return

        project_id = filters['project_id']
        environment_id = filters.get('environment_id')

        # a TagValue was created for this environment,
        # so we incr the values_seen for the TagKey in that environment
        tagstore.incr_tag_key_values_seen(project_id, environment_id, filters['key'])

    @buffer_incr_complete.connect(sender=grouptagvalue_model, weak=False)
    def record_group_tag_count(filters, created, extra, **kwargs):
        from sentry import tagstore

        if not created:
            return

        project_id = extra['project_id']
        group_id = filters['group_id']
        environment_id = filters.get('environment_id')

        # a GroupTagValue was created for this environment,
        # so we incr the values_seen for the GroupTagKey in that environment
        tagstore.incr_group_tag_key_values_seen(
            project_id, group_id, environment_id, filters['key'])

    post_save.connect(
        ensure_release_exists, sender=tagvalue_model, dispatch_uid="ensure_release_exists", weak=False
    )
