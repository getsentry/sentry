from __future__ import absolute_import

import logging

from click import echo
from django.conf import settings
from django.db import connections, transaction
from django.contrib.auth.models import AnonymousUser
from django.db.utils import OperationalError, ProgrammingError
from django.db.models.signals import post_migrate, post_save
from functools import wraps
from pkg_resources import parse_version as Version

from sentry import options
from sentry.models import Organization, OrganizationMember, Project, User, Team, ProjectKey
from sentry.signals import project_created

PROJECT_SEQUENCE_FIX = """
SELECT setval('sentry_project_id_seq', (
    SELECT GREATEST(MAX(id) + 1, nextval('sentry_project_id_seq')) - 1
    FROM sentry_project))
"""
DEFAULT_SENTRY_PROJECT_ID = 1


def handle_db_failure(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            with transaction.atomic():
                return func(*args, **kwargs)
        except (ProgrammingError, OperationalError):
            logging.exception("Failed processing signal %s", func.__name__)
            return

    return wrapped


def create_default_projects(app_config, verbosity=2, **kwargs):
    if app_config and app_config.name != "sentry":
        return

    try:
        app_config.get_model("Project")
    except LookupError:
        return

    create_default_project(
        # This guards against sentry installs that have SENTRY_PROJECT set to None, so
        # that they don't error after every migration. Specifically for single tenant.
        id=settings.SENTRY_PROJECT or DEFAULT_SENTRY_PROJECT_ID,
        name="Internal",
        slug="internal",
        verbosity=verbosity,
    )

    if settings.SENTRY_FRONTEND_PROJECT:
        create_default_project(
            id=settings.SENTRY_FRONTEND_PROJECT,
            name="Frontend",
            slug="frontend",
            verbosity=verbosity,
        )


def create_default_project(id, name, slug, verbosity=2, **kwargs):
    if Project.objects.filter(id=id).exists():
        return

    try:
        user = User.objects.filter(is_superuser=True)[0]
    except IndexError:
        user = None

    org, _ = Organization.objects.get_or_create(slug="sentry", defaults={"name": "Sentry"})

    if user:
        OrganizationMember.objects.get_or_create(user=user, organization=org, role="owner")

    team, _ = Team.objects.get_or_create(
        organization=org, slug="sentry", defaults={"name": "Sentry"}
    )

    with transaction.atomic():
        project = Project.objects.create(
            id=id, public=False, name=name, slug=slug, organization=team.organization, **kwargs
        )
        project.add_team(team)

        project_created.send(
            project=project,
            user=user or AnonymousUser(),
            default_rules=True,
            sender=create_default_project,
        )

        # HACK: manually update the ID after insert due to Postgres
        # sequence issues. Seriously, fuck everything about this.
        connection = connections[project._state.db]
        cursor = connection.cursor()
        cursor.execute(PROJECT_SEQUENCE_FIX)

    project.update_option("sentry:origins", ["*"])

    if verbosity > 0:
        echo("Created internal Sentry project (slug=%s, id=%s)" % (project.slug, project.id))

    return project


def set_sentry_version(latest=None, **kwargs):
    import sentry

    current = sentry.VERSION

    version = options.get("sentry:latest_version")

    for ver in (current, version):
        if Version(ver) >= Version(latest):
            latest = ver

    if latest == version:
        return

    options.set("sentry:latest_version", (latest or current))


def create_keys_for_project(instance, created, app=None, **kwargs):
    if app and app.__name__ != "sentry.models":
        return

    if not created or kwargs.get("raw"):
        return

    if not ProjectKey.objects.filter(project=instance).exists():
        ProjectKey.objects.create(project=instance, label="Default")


def freeze_option_epoch_for_project(instance, created, app=None, **kwargs):
    if app and app.__name__ != "sentry.models":
        return

    if not created or kwargs.get("raw"):
        return

    from sentry import projectoptions

    projectoptions.default_manager.freeze_option_epoch(project=instance, force=False)


# Anything that relies on default objects that may not exist with default
# fields should be wrapped in handle_db_failure
post_migrate.connect(
    handle_db_failure(create_default_projects), dispatch_uid="create_default_project", weak=False
)

post_save.connect(
    handle_db_failure(create_keys_for_project),
    sender=Project,
    dispatch_uid="create_keys_for_project",
    weak=False,
)
post_save.connect(
    handle_db_failure(freeze_option_epoch_for_project),
    sender=Project,
    dispatch_uid="freeze_option_epoch_for_project",
    weak=False,
)
