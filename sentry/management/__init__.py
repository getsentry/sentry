"""
sentry.management
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from django.contrib.auth.models import User
from django.db.models.signals import post_syncdb, post_save

from sentry.conf import settings
from sentry.models import Project, MessageIndex, SearchDocument, \
  Group, Event, FilterValue, MessageFilterValue, MessageCountByMinute, \
  MEMBER_OWNER, MEMBER_USER, MEMBER_SYSTEM


def register_indexes():
    """
    Grabs all required indexes from filters and registers them.
    """
    from sentry.filters import Filter
    logger = logging.getLogger('sentry.setup')
    for cls in (f for f in Filter.objects.all() if f.column.startswith('data__')):
        MessageIndex.objects.register_index(cls.column, index_to='group')
        logger.debug('Registered index for for %r' % cls.column)
register_indexes()


def create_default_project(created_models, verbosity=2, **kwargs):
    if Project in created_models:
        try:
            owner = User.objects.filter(is_staff=True, is_superuser=True).order_by('id')[0]
        except IndexError:
            owner = None

        project, created = Project.objects.get_or_create(
            id=1,
            defaults=dict(
                public=True,
                name='Default',
                owner=owner,
            )
        )
        if not created:
            return

        if verbosity > 0:
            print 'Created default Sentry project owned by %s' % owner

        # Iterate all groups to update their relations
        for model in (Group, Event, FilterValue, MessageFilterValue,
                      MessageCountByMinute):
            if verbosity > 0:
                print ('Backfilling project ids for %s.. ' % model),
            model.objects.filter(project__isnull=True).update(
                project=project,
            )
            if verbosity > 0:
                print 'done!'


def create_project_member_for_owner(instance, created, **kwargs):
    if not created:
        return

    if not instance.owner:
        return

    instance.member_set.create(
        user=instance.owner,
        type=globals()[settings.DEFAULT_PROJECT_ACCESS]
    )


def update_document(instance, created, **kwargs):
    if created:
        return

    SearchDocument.objects.filter(
        project=instance.project,
        group=instance,
    ).update(status=instance.status)

# Signal registration
post_syncdb.connect(
    create_default_project,
    dispatch_uid="create_default_project",
    weak=False,
)
post_save.connect(
    create_project_member_for_owner,
    sender=Project,
    dispatch_uid="create_project_member_for_owner",
    weak=False,
)
post_save.connect(
    update_document,
    sender=Group,
    dispatch_uid="update_document",
    weak=False,
)