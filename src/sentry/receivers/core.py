from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError
from django.db.models.signals import post_syncdb, post_save
from functools import wraps
from pkg_resources import parse_version as Version

from sentry import options
from sentry.models import (
    Organization, OrganizationMember, Project, User,
    Team, ProjectKey, TagKey, TagValue, GroupTagValue, GroupTagKey
)
from sentry.signals import buffer_incr_complete
from sentry.utils import db

PROJECT_SEQUENCE_FIX = """
SELECT setval('sentry_project_id_seq', (
    SELECT GREATEST(MAX(id) + 1, nextval('sentry_project_id_seq')) - 1
    FROM sentry_project))
"""


def handle_db_failure(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except (ProgrammingError, OperationalError):
            logging.exception('Failed processing signal %s', func.__name__)
            return
    return wrapped


def create_default_projects(created_models, verbosity=2, **kwargs):
    if Project not in created_models:
        return

    create_default_project(
        id=settings.SENTRY_PROJECT,
        name='Internal',
        slug='internal',
        verbosity=verbosity,
    )

    if settings.SENTRY_FRONTEND_PROJECT:
        create_default_project(
            id=settings.SENTRY_FRONTEND_PROJECT,
            name='Frontend',
            slug='frontend',
            verbosity=verbosity,
        )


def create_default_project(id, name, slug, verbosity=2, **kwargs):
    if Project.objects.filter(id=id).exists():
        return

    try:
        user = User.objects.filter(is_superuser=True)[0]
    except IndexError:
        user = None

    org, _ = Organization.objects.get_or_create(
        slug='sentry',
        defaults={
            'name': 'Sentry',
        }
    )

    if user:
        OrganizationMember.objects.get_or_create(
            user=user,
            organization=org,
            role='owner',
        )

    team, _ = Team.objects.get_or_create(
        organization=org,
        slug='sentry',
        defaults={
            'name': 'Sentry',
        }
    )

    project = Project.objects.create(
        id=id,
        public=False,
        name=name,
        slug=slug,
        team=team,
        organization=team.organization,
        **kwargs
    )

    # HACK: manually update the ID after insert due to Postgres
    # sequence issues. Seriously, fuck everything about this.
    if db.is_postgres(project._state.db):
        connection = connections[project._state.db]
        cursor = connection.cursor()
        cursor.execute(PROJECT_SEQUENCE_FIX)

    project.update_option('sentry:origins', ['*'])

    if verbosity > 0:
        print('Created internal Sentry project (slug=%s, id=%s)' % (project.slug, project.id))

    return project


def set_sentry_version(latest=None, **kwargs):
    import sentry
    current = sentry.VERSION

    version = options.get('sentry:latest_version')

    for ver in (current, version):
        if Version(ver) >= Version(latest):
            latest = ver

    if latest == version:
        return

    options.set('sentry:latest_version', (latest or current))


def create_keys_for_project(instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return

    if not ProjectKey.objects.filter(project=instance).exists():
        ProjectKey.objects.create(
            project=instance,
            label='Default',
        )


@buffer_incr_complete.connect(sender=TagValue, weak=False)
def record_project_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    # TODO(dcramer): remove in 7.6.x
    project_id = filters.get('project_id')
    if not project_id:
        project_id = filters['project'].id

    app.buffer.incr(TagKey, {
        'values_seen': 1,
    }, {
        'project_id': project_id,
        'key': filters['key'],
    })


@buffer_incr_complete.connect(sender=GroupTagValue, weak=False)
def record_group_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    # TODO(dcramer): remove in 7.6.x
    project_id = filters.get('project_id')
    if not project_id:
        project_id = filters['project'].id

    group_id = filters.get('group_id')
    if not group_id:
        group_id = filters['group'].id

    app.buffer.incr(GroupTagKey, {
        'values_seen': 1,
    }, {
        'project_id': project_id,
        'group_id': group_id,
        'key': filters['key'],
    })


# Anything that relies on default objects that may not exist with default
# fields should be wrapped in handle_db_failure
post_syncdb.connect(
    handle_db_failure(create_default_projects),
    dispatch_uid="create_default_project",
    weak=False,
)
post_save.connect(
    handle_db_failure(create_keys_for_project),
    sender=Project,
    dispatch_uid="create_keys_for_project",
    weak=False,
)
