from __future__ import absolute_import, print_function

from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.db import connections
from django.db.models.signals import post_syncdb, post_save, pre_delete
from pkg_resources import parse_version as Version

from sentry import options
from sentry.constants import MEMBER_OWNER
from sentry.db.models import update
from sentry.db.models.utils import slugify_instance
from sentry.models import (
    Project, User, Team, ProjectKey, UserOption, TagKey, TagValue,
    GroupTagValue, GroupTagKey, Activity, TeamMember, Alert)
from sentry.signals import buffer_incr_complete, regression_signal
from sentry.utils.safe import safe_execute

PROJECT_SEQUENCE_FIX = """
SELECT setval('sentry_project_id_seq', (
    SELECT GREATEST(MAX(id) + 1, nextval('sentry_project_id_seq')) - 1
    FROM sentry_project))
"""


def create_default_projects(created_models, verbosity=2, **kwargs):
    if Project not in created_models:
        return

    create_default_project(
        id=settings.SENTRY_PROJECT,
        name='Backend',
        slug='backend',
        verbosity=verbosity,
        platform='django',
    )
    if settings.SENTRY_FRONTEND_PROJECT:
        project = create_default_project(
            id=settings.SENTRY_FRONTEND_PROJECT,
            name='Frontend',
            slug='frontend',
            verbosity=verbosity,
            platform='javascript'
        )


def create_default_project(id, name, slug, verbosity=2, **kwargs):
    if Project.objects.filter(id=id).exists():
        return

    try:
        user = User.objects.filter(is_superuser=True)[0]
    except IndexError:
        user, _ = User.objects.get_or_create(
            username='sentry',
            defaults={
                'email': 'sentry@localhost',
            }
        )

    team, _ = Team.objects.get_or_create(
        name='Sentry',
        defaults={
            'owner': user,
        }
    )

    project = Project.objects.create(
        id=id,
        public=False,
        name=name,
        slug=slug,
        owner=user,
        team=team,
        **kwargs
    )

    # HACK: manually update the ID after insert due to Postgres
    # sequence issues. Seriously, fuck everything about this.
    connection = connections[project._state.db]
    if connection.settings_dict['ENGINE'].endswith('psycopg2'):
        cursor = connection.cursor()
        cursor.execute(PROJECT_SEQUENCE_FIX)

    project.update_option('sentry:origins', ['*'])

    if verbosity > 0:
        print('Created internal Sentry project (slug=%s, id=%s)' % (project.slug, project.id))

    return project


def set_sentry_version(latest=None, **kwargs):
    import sentry
    current = sentry.get_version()

    version = options.get('sentry:latest_version')

    for ver in (current, version):
        if Version(ver) >= Version(latest):
            return

    options.set('sentry:latest_version', (latest or current))


def create_team_and_keys_for_project(instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return

    if not ProjectKey.objects.filter(project=instance, user__isnull=True).exists():
        ProjectKey.objects.create(
            project=instance,
        )

    if not instance.owner:
        return

    if not instance.team:
        team = Team(owner=instance.owner, name=instance.name)
        slugify_instance(team, instance.slug)
        team.save()
        update(instance, team=team)


def create_team_member_for_owner(instance, created, **kwargs):
    if not created:
        return

    if not instance.owner:
        return

    instance.member_set.get_or_create(
        user=instance.owner,
        type=MEMBER_OWNER,
    )


def remove_key_for_team_member(instance, **kwargs):
    for project in instance.team.project_set.all():
        ProjectKey.objects.filter(
            project=project,
            user=instance.user,
        ).delete()


# Set user language if set
def set_language_on_logon(request, user, **kwargs):
    language = UserOption.objects.get_value(
        user=user,
        project=None,
        key='language',
        default=None,
    )
    if language and hasattr(request, 'session'):
        request.session['django_language'] = language


@buffer_incr_complete.connect(sender=TagValue, weak=False)
def record_project_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    app.buffer.incr(TagKey, {
        'values_seen': 1,
    }, {
        'project': filters['project'],
        'key': filters['key'],
    })


@buffer_incr_complete.connect(sender=GroupTagValue, weak=False)
def record_group_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    app.buffer.incr(GroupTagKey, {
        'values_seen': 1,
    }, {
        'project': filters['project'],
        'group': filters['group'],
        'key': filters['key'],
    })


@regression_signal.connect(weak=False)
def create_regression_activity(instance, **kwargs):
    if instance.times_seen == 1:
        # this event is new
        return
    Activity.objects.create(
        project=instance.project,
        group=instance,
        type=Activity.SET_REGRESSION,
    )


def on_alert_creation(instance, **kwargs):
    from sentry.plugins import plugins

    for plugin in plugins.for_project(instance.project):
        safe_execute(plugin.on_alert, alert=instance)


# Signal registration
post_syncdb.connect(
    create_default_projects,
    dispatch_uid="create_default_project",
    weak=False,
)
post_save.connect(
    create_team_and_keys_for_project,
    sender=Project,
    dispatch_uid="create_team_and_keys_for_project",
    weak=False,
)
post_save.connect(
    create_team_member_for_owner,
    sender=Team,
    dispatch_uid="create_team_member_for_owner",
    weak=False,
)
pre_delete.connect(
    remove_key_for_team_member,
    sender=TeamMember,
    dispatch_uid="remove_key_for_team_member",
    weak=False,
)
user_logged_in.connect(
    set_language_on_logon,
    dispatch_uid="set_language_on_logon",
    weak=False
)
post_save.connect(
    on_alert_creation,
    sender=Alert,
    dispatch_uid="on_alert_creation",
    weak=False,
)
