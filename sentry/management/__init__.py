"""
sentry.management
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging
from django.contrib.auth.models import User
from django.db.models.signals import post_syncdb
from sentry.models import Project, ProjectMember, MessageIndex, \
  Group, Event, FilterValue, MessageFilterValue, MessageCountByMinute, \
  MEMBER_OWNER


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

        if owner:
            ProjectMember.objects.create(
                project=project,
                user=owner,
                type=MEMBER_OWNER,
            )

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

# Signal registration
post_syncdb.connect(
    create_default_project,
    dispatch_uid="create_default_project"
)
