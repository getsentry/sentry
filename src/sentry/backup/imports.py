from __future__ import annotations

from typing import BinaryIO, Iterator, Optional, Tuple, Type

import click
from django.conf import settings
from django.core import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, connections, router, transaction
from django.db.models.base import Model
from rest_framework.serializers import ValidationError as DjangoRestFrameworkValidationError

from sentry.backup.dependencies import NormalizedModelName, PrimaryKeyMap, get_model, get_model_name
from sentry.backup.helpers import EXCLUDED_APPS, Filter, ImportFlags, decrypt_encrypted_tarball
from sentry.backup.scopes import ImportScope
from sentry.silo import unguarded_write
from sentry.utils import json

__all__ = (
    "import_in_user_scope",
    "import_in_organization_scope",
    "import_in_config_scope",
    "import_in_global_scope",
)


def _import(
    src: BinaryIO,
    scope: ImportScope,
    *,
    decrypt_with: BinaryIO | None = None,
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
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.user import User

    flags = flags if flags is not None else ImportFlags()
    user_model_name = get_model_name(User)
    org_model_name = get_model_name(Organization)
    org_member_model_name = get_model_name(OrganizationMember)

    # TODO(getsentry#team-ospo/190): Reading the entire export into memory as a string is quite
    # wasteful - in the future, we should explore chunking strategies to enable a smaller memory
    # footprint when processing super large (>100MB) exports.
    content = (
        decrypt_encrypted_tarball(src, decrypt_with)
        if decrypt_with is not None
        else src.read().decode("utf-8")
    )
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
            user_filter: Filter[int] = Filter(model=User, field="pk")
            filters.append(user_filter)

            # TODO(getsentry#team-ospo/190): It turns out that Django's "streaming" JSON
            # deserializer does no such thing, and actually loads the entire JSON into memory! If we
            # don't want to choke on large imports, we'll need use a truly "chunkable" JSON
            # importing library like ijson for this.
            for obj in serializers.deserialize("json", content):
                o = obj.object
                model_name = get_model_name(o)
                if model_name == user_model_name:
                    username = getattr(o, "username", None)
                    email = getattr(o, "email", None)
                    if username is not None and email is not None:
                        user_to_email[username] = email
                elif model_name == org_model_name:
                    pk = getattr(o, "pk", None)
                    slug = getattr(o, "slug", None)
                    if pk is not None and slug in filter_by.values:
                        filtered_org_pks.add(pk)
                elif model_name == org_member_model_name:
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
            for obj in serializers.deserialize("json", content):
                o = obj.object
                model_name = get_model_name(o)
                if model_name == user_model_name:
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

    # The input JSON blob should already be ordered by model kind. We simply break up 1 JSON blob
    # with N model kinds into N json blobs with 1 model kind each.
    def yield_json_models(src) -> Iterator[Tuple[NormalizedModelName, str]]:
        # TODO(getsentry#team-ospo/190): Better error handling for unparsable JSON.
        models = json.loads(content)
        last_seen_model_name: Optional[NormalizedModelName] = None
        batch: list[Type[Model]] = []
        for model in models:
            model_name = NormalizedModelName(model["model"])
            if last_seen_model_name != model_name:
                if last_seen_model_name is not None and len(batch) > 0:
                    yield (last_seen_model_name, json.dumps(batch))

                batch = []
                last_seen_model_name = model_name

            batch.append(model)

        if last_seen_model_name is not None and batch:
            yield (last_seen_model_name, json.dumps(batch))

    # Extract some write logic into its own internal function, so that we may call it irrespective
    # of how we do atomicity: on a per-model (if using multiple dbs) or global (if using a single
    # db) basis.
    def do_write():
        allowed_relocation_scopes = scope.value
        pk_map = PrimaryKeyMap()
        for (batch_model_name, batch) in yield_json_models(src):
            model = get_model(batch_model_name)
            if model is None:
                raise ValueError("Unknown model name")

            using = router.db_for_write(model)
            with transaction.atomic(using=using):
                count = 0
                for obj in serializers.deserialize("json", batch, use_natural_keys=False):
                    o = obj.object
                    if o._meta.app_label not in EXCLUDED_APPS or o:
                        if o.get_possible_relocation_scopes() & allowed_relocation_scopes:
                            o = obj.object
                            model_name = get_model_name(o)
                            for f in filters:
                                if f.model == type(o) and getattr(o, f.field, None) not in f.values:
                                    break
                            else:
                                # We can only be sure `get_relocation_scope()` will be correct if it
                                # is fired AFTER normalization, as some `get_relocation_scope()`
                                # methods rely on being able to correctly resolve foreign keys,
                                # which is only possible after normalization.
                                old_pk = o.normalize_before_relocation_import(pk_map, scope, flags)
                                if old_pk is None:
                                    continue

                                # Now that the model has been normalized, we can ensure that this
                                # particular instance has a `RelocationScope` that permits
                                # importing.
                                if not o.get_relocation_scope() in allowed_relocation_scopes:
                                    continue

                                written = o.write_relocation_import(scope, flags)
                                if written is None:
                                    continue

                                new_pk, import_kind = written
                                slug = getattr(o, "slug", None)
                                pk_map.insert(model_name, old_pk, new_pk, import_kind, slug)
                                count += 1

                # If we wrote at least one model, make sure to update the sequences too.
                if count > 0:
                    table = o._meta.db_table
                    seq = f"{table}_id_seq"
                    with connections[using].cursor() as cursor:
                        cursor.execute(f"SELECT setval(%s, (SELECT MAX(id) FROM {table}))", [seq])

    try:
        if len(settings.DATABASES) == 1:
            # TODO(getsentry/team-ospo#185): This is currently untested in single-db mode. Fix ASAP!
            with unguarded_write(using="default"), transaction.atomic("default"):
                do_write()
        else:
            do_write()

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


def import_in_user_scope(
    src: BinaryIO,
    *,
    decrypt_with: BinaryIO | None = None,
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
        decrypt_with=decrypt_with,
        flags=flags,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def import_in_organization_scope(
    src: BinaryIO,
    *,
    decrypt_with: BinaryIO | None = None,
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
        decrypt_with=decrypt_with,
        flags=flags,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        printer=printer,
    )


def import_in_config_scope(
    src: BinaryIO,
    *,
    decrypt_with: BinaryIO | None = None,
    flags: ImportFlags | None = None,
    user_filter: set[str] | None = None,
    printer=click.echo,
):
    """
    Perform an import in the `Config` scope, meaning that we will import all models required to
    globally configure and administrate a Sentry instance from the provided `src` file. This
    requires importing all users in the supplied file, including those with administrator
    privileges.

    Like imports in the `Global` scope, superuser and administrator privileges are not sanitized.
    Unlike the `Global` scope, however, user-specific authentication information 2FA methods and
    social login connections are not retained.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _import(
        src,
        ImportScope.Config,
        decrypt_with=decrypt_with,
        flags=flags,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def import_in_global_scope(
    src: BinaryIO,
    *,
    decrypt_with: BinaryIO | None = None,
    flags: ImportFlags | None = None,
    printer=click.echo,
):
    """
    Perform an import in the `Global` scope, meaning that all models will be imported from the
    provided source file. Because a `Global` import is really only useful when restoring to a fresh
    Sentry instance, some behaviors in this scope are different from the others. In particular,
    superuser privileges are not sanitized. This method can be thought of as a "pure" backup/restore, simply serializing and deserializing a (partial) snapshot of the database state.
    """

    return _import(
        src,
        ImportScope.Global,
        decrypt_with=decrypt_with,
        flags=flags,
        printer=printer,
    )
