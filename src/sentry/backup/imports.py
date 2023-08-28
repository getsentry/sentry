from __future__ import annotations

from io import StringIO
from typing import NamedTuple

import click
from django.apps import apps
from django.core import management, serializers
from django.db import IntegrityError, connection, transaction
from django.forms import model_to_dict

from sentry.backup.dependencies import PrimaryKeyMap, dependencies, normalize_model_name
from sentry.backup.helpers import EXCLUDED_APPS


class OldImportConfig(NamedTuple):
    """While we are migrating to the new backup system, we need to take care not to break the old
    and relatively untested workflows. This model allows us to stub in the old configs."""

    # Do we allow users to update existing models, or force them to only insert new ones? The old
    # behavior was to allow updates of already included models, but we want to move away from this.
    # TODO(getsentry/team-ospo#170): This is a noop for now, but will be used as we migrate to
    # `INSERT-only` importing logic.
    use_update_instead_of_create: bool = False

    # Old imports use "natural" foreign keys, which in practice only changes how foreign keys into
    # `sentry.User` are represented.
    use_natural_foreign_keys: bool = False


def imports(src, old_config: OldImportConfig, printer=click.echo):
    """Imports core data for the Sentry installation."""

    # TODO(hybrid-cloud): actor refactor. Remove this import when done.
    from sentry.models.actor import Actor

    try:
        # Import / export only works in monolith mode with a consolidated db.
        with transaction.atomic("default"):
            pk_map = PrimaryKeyMap()
            deps = dependencies()

            for obj in serializers.deserialize(
                "json", src, stream=True, use_natural_keys=old_config.use_natural_foreign_keys
            ):
                if obj.object._meta.app_label not in EXCLUDED_APPS:
                    # TODO(getsentry/team-ospo#183): This conditional should be removed once we want
                    # to roll out the new API to self-hosted.
                    if old_config.use_update_instead_of_create:
                        obj.save()
                    else:
                        o = obj.object
                        label = o._meta.label_lower
                        model_name = normalize_model_name(o)
                        for field, model_relation in deps[model_name].foreign_keys.items():
                            field_id = field if field.endswith("_id") else f"{field}_id"
                            fk = getattr(o, field_id, None)
                            if fk is not None:
                                new_pk = pk_map.get(normalize_model_name(model_relation.model), fk)
                                # TODO(getsentry/team-ospo#167): Will allow missing items when we
                                # implement org-based filtering.
                                setattr(o, field_id, new_pk)

                        old_pk = o.pk
                        o.pk = None
                        o.id = None

                        # TODO(hybrid-cloud): actor refactor. Remove this conditional when done.
                        #
                        # `Actor` and `Team` have a direct circular dependency between them for the
                        # time being due to an ongoing refactor (that is, `Actor` foreign keys
                        # directly into `Team`, and `Team` foreign keys directly into `Actor`). If
                        # we use `INSERT` database calls naively, they will always fail, because one
                        # half of the cycle will always be missing.
                        #
                        # Because `Actor` ends up first in the dependency sorting (see:
                        # fixtures/backup/model_dependencies/sorted.json), a viable solution here is
                        # to always null out the `team_id` field of the `Actor` when we write it,
                        # and then make sure to circle back and update the relevant actor after we
                        # create the `Team` models later on (see snippet at the end of this scope).
                        if label == "sentry.actor":
                            o.team_id = None

                        # TODO(getsentry/team-ospo#181): what's up with email/useremail here? Seems
                        # like both gets added with `sentry.user` simultaneously? Will need to make
                        # more robust user handling logic, and to test what happens when a UserEmail
                        # already exists.
                        if label == "sentry.useremail":
                            (o, _) = o.__class__.objects.get_or_create(
                                user=o.user, email=o.email, defaults=model_to_dict(o)
                            )
                            pk_map.insert(model_name, old_pk, o.pk)
                            continue

                        obj.save(force_insert=True)
                        pk_map.insert(model_name, old_pk, o.pk)

                        # TODO(hybrid-cloud): actor refactor. Remove this conditional when done.
                        if label == "sentry.team":
                            if o.actor_id is not None:
                                actor = Actor.objects.get(pk=o.actor_id)
                                actor.team_id = o.pk
                                actor.save()

    # For all database integrity errors, let's warn users to follow our
    # recommended backup/restore workflow before reraising exception. Most of
    # these errors come from restoring on a different version of Sentry or not restoring
    # on a clean install.
    except IntegrityError as e:
        warningText = ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose"
        printer(
            warningText,
            err=True,
        )
        raise (e)

    sequence_reset_sql = StringIO()

    for app in apps.get_app_configs():
        management.call_command(
            "sqlsequencereset", app.label, "--no-color", stdout=sequence_reset_sql
        )

    with connection.cursor() as cursor:
        cursor.execute(sequence_reset_sql.getvalue())
