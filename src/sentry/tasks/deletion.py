"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(name='sentry.tasks.deletion.delete_project', queue='cleanup')
def delete_project(object_id, **kwargs):
    from sentry.models import Project

    try:
        p = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    p.delete()


@task(name='sentry.tasks.deletion.delete_group', queue='cleanup')
def delete_group(object_id, **kwargs):
    from sentry.models import Group

    try:
        g = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    g.delete()
