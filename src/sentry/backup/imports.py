from __future__ import annotations

from io import StringIO

import click
from django.apps import apps
from django.core import management, serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, connection, transaction
from rest_framework.serializers import ValidationError as DjangoRestFrameworkValidationError

from sentry.backup.dependencies import PrimaryKeyMap, normalize_model_name
from sentry.backup.helpers import EXCLUDED_APPS, Filter, ImportFlags
from sentry.backup.scopes import ImportScope
from sentry.silo import unguarded_write

__all__ = (
    "import_in_user_scope",
    "import_in_organization_scope",
    "import_in_global_scope",
)


def _import(
    src,
    scope: ImportScope,
    *,
    flags: ImportFlags | None = None,
    filter_by: Filter | None = None,
    printer=click.echo,
):
    """
    Imports core data for a Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain combinations of input parameters that should not be used together. Instead, use one of the other wrapper functions in this file, named `import_in_XXX_scope()`.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.email import Email
    from sentry.models.organization import Organization
    from sentry.models.user import User

    start = src.tell()
    filters = []
    if filter_by is not None:
        filters.append(filter_by)

        # `sentry.Email` models don't have any explicit dependencies on `User`, so we need to find
        # and record them manually.
        user_to_email = dict()

        if filter_by.model == Organization:
            # To properly filter organizations, we need to grab their users first. There is no
            # elegant way to do this: we'll just have to read the import JSON until we get to the
            # bit that contains the `sentry.Organization` entries, filter them by their slugs, then
            # look through the subsequent `sentry.OrganizationMember` entries to pick out members of
            # matched orgs, and finally add those pks to a `User.pk` instance of `Filter`.
            filtered_org_pks = set()
            seen_first_org_member_model = False
            user_filter = Filter(model=User, field="pk")
            filters.append(user_filter)

            for obj in serializers.deserialize("json", src, stream=True):
                o = obj.object
                model_name = normalize_model_name(o)
                if model_name == "sentry.User":
                    username = getattr(o, "username", None)
                    email = getattr(o, "email", None)
                    if username is not None and email is not None:
                        user_to_email[username] = email
                elif model_name == "sentry.Organization":
                    pk = getattr(o, "pk", None)
                    slug = getattr(o, "slug", None)
                    if pk is not None and slug in filter_by.values:
                        filtered_org_pks.add(pk)
                elif model_name == "sentry.OrganizationMember":
                    seen_first_org_member_model = True
                    user = getattr(o, "user_id", None)
                    org = getattr(o, "organization_id", None)
                    if user is not None and org in filtered_org_pks:
                        user_filter.values.add(user)
                elif seen_first_org_member_model:
                    # Exports should be grouped by model, so we've already seen every user, org and
                    # org member we're going to see. We can ignore the rest of the models.
                    break
        elif filter_by.model == User:
            seen_first_user_model = False
            for obj in serializers.deserialize("json", src, stream=True):
                o = obj.object
                model_name = normalize_model_name(o)
                if model_name == "sentry.User":
                    seen_first_user_model = False
                    username = getattr(o, "username", None)
                    email = getattr(o, "email", None)
                    if username is not None and email is not None:
                        user_to_email[username] = email
                elif seen_first_user_model:
                    break
        else:
            raise TypeError("Filter arguments must only apply to `Organization` or `User` models")

        user_filter = next(f for f in filters if f.model == User)
        email_filter = Filter(
            model=Email,
            field="email",
            values={v for k, v in user_to_email.items() if k in user_filter.values},
        )

        filters.append(email_filter)

    src.seek(start)
    try:
        # Import / export only works in monolith mode with a consolidated db.
        # TODO(getsentry/team-ospo#185): the `unguarded_write` is temporary until we get an RPC
        # service up for writing to control silo models.
        with unguarded_write(using="default"), transaction.atomic("default"):
            allowed_relocation_scopes = scope.value
            flags = flags if flags is not None else ImportFlags()
            pk_map = PrimaryKeyMap()
            for obj in serializers.deserialize("json", src, stream=True, use_natural_keys=False):
                o = obj.object
                if o._meta.app_label not in EXCLUDED_APPS or o:
                    if o.get_possible_relocation_scopes() & allowed_relocation_scopes:
                        o = obj.object
                        model_name = normalize_model_name(o)
                        for f in filters:
                            if f.model == type(o) and getattr(o, f.field, None) not in f.values:
                                break
                        else:
                            # We can only be sure `get_relocation_scope()` will be correct if it is
                            # fired AFTER normalization, as some `get_relocation_scope()` methods
                            # rely on being able to correctly resolve foreign keys, which is only
                            # possible after normalization.
                            old_pk = o.normalize_before_relocation_import(pk_map, scope, flags)
                            if old_pk is None:
                                continue

                            # Now that the model has been normalized, we can ensure that this
                            # particular instance has a `RelocationScope` that permits importing.
                            if not o.get_relocation_scope() in allowed_relocation_scopes:
                                continue

                            written = o.write_relocation_import(scope, flags)
                            if written is None:
                                continue

                            new_pk, import_kind = written
                            pk_map.insert(model_name, old_pk, new_pk, import_kind)

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

    # Calls to `write_relocation_import` may fail validation and throw either a
    # `DjangoValidationError` when a call to `.full_clean()` failed, or a
    # `DjangoRestFrameworkValidationError` when a call to a custom DRF serializer failed. This
    # exception catcher converts instances of the former to the latter.
    except DjangoValidationError as e:
        errs = {field: error for field, error in e.message_dict.items()}
        raise DjangoRestFrameworkValidationError(errs) from e

    sql = StringIO()
    err = StringIO()
    for app in apps.get_app_configs():
        management.call_command("sqlsequencereset", app.label, "--no-color", stdout=sql, stderr=err)
    with connection.cursor() as cursor:
        cursor.execute(sql.getvalue())

    errored = "\n".join(
        [li for li in err.getvalue().splitlines() if "No sequences found." not in li]
    ).strip()
    if errored:
        raise ValueError(f"Encountered SQL errors:\n\n {errs}")


def import_in_user_scope(
    src,
    *,
    flags: ImportFlags | None = None,
    user_filter: set[str] | None = None,
    printer=click.echo,
):
    """
    Perform an import in the `User` scope, meaning that only models with `RelocationScope.User` will be imported from the provided `src` file.

    The `user_filter` argument allows imports to be filtered by username. If the argument is set to `None`, there is no filtering, meaning all encountered users are imported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _import(
        src,
        ImportScope.User,
        flags=flags,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def import_in_organization_scope(
    src,
    *,
    flags: ImportFlags | None = None,
    org_filter: set[str] | None = None,
    printer=click.echo,
):
    """
    Perform an import in the `Organization` scope, meaning that only models with
    `RelocationScope.User` or `RelocationScope.Organization` will be imported from the provided
    `src` file.

    The `org_filter` argument allows imports to be filtered by organization slug. If the argument
    is set to `None`, there is no filtering, meaning all encountered organizations and users are
    imported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization

    return _import(
        src,
        ImportScope.Organization,
        flags=flags,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        printer=printer,
    )


def import_in_global_scope(src, *, flags: ImportFlags | None = None, printer=click.echo):
    """
    Perform an import in the `Global` scope, meaning that all models will be imported from the
    provided source file. Because a `Global` import is really only useful when restoring to a fresh
    Sentry instance, some behaviors in this scope are different from the others. In particular,
    superuser privileges are not sanitized.
    """

    return _import(src, ImportScope.Global, flags=flags, printer=printer)
