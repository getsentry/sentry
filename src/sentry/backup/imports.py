from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO, Iterator, Optional, Tuple, Type
from uuid import uuid4

from django.core import serializers
from django.db import DatabaseError, connections, router, transaction
from django.db.models.base import Model

from sentry.backup.dependencies import (
    ImportKind,
    ModelRelations,
    NormalizedModelName,
    PrimaryKeyMap,
    dependencies,
    get_model_name,
    reversed_dependencies,
)
from sentry.backup.helpers import Decryptor, Filter, ImportFlags, Printer, decrypt_encrypted_tarball
from sentry.backup.scopes import ImportScope
from sentry.db.models.paranoia import ParanoidModel
from sentry.models.importchunk import ControlImportChunkReplica
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.nodestore.django.models import Node
from sentry.services.hybrid_cloud.import_export.model import (
    RpcFilter,
    RpcImportError,
    RpcImportErrorKind,
    RpcImportFlags,
    RpcImportScope,
    RpcPrimaryKeyMap,
)
from sentry.services.hybrid_cloud.import_export.service import ImportExportService
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.utils import json
from sentry.utils.env import is_split_db

__all__ = (
    "ImportingError",
    "import_in_user_scope",
    "import_in_organization_scope",
    "import_in_config_scope",
    "import_in_global_scope",
)


class ImportingError(Exception):
    def __init__(self, context: RpcImportError) -> None:
        self.context = context


def _clear_model_tables_before_import():
    reversed = reversed_dependencies()

    for model in reversed:
        using = router.db_for_write(model)
        manager = model.with_deleted if issubclass(model, ParanoidModel) else model.objects
        manager.all().delete()  # type: ignore

        # TODO(getsentry/team-ospo#190): Remove the "Node" kludge below in favor of a more permanent
        # solution.
        if model is not Node:
            table = model._meta.db_table
            seq = f"{table}_id_seq"
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT setval(%s, 1, false)", [seq])


def _import(
    src: BinaryIO,
    scope: ImportScope,
    *,
    decryptor: Decryptor | None = None,
    flags: ImportFlags | None = None,
    filter_by: Filter | None = None,
    printer: Printer,
):
    """
    Imports core data for a Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain
    combinations of input parameters that should not be used together. Instead, use one of the other
    wrapper functions in this file, named `import_in_XXX_scope()`.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.email import Email
    from sentry.models.organization import Organization
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.user import User

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        errText = "Imports must be run in REGION or MONOLITH instances only"
        printer.echo(errText, err=True)
        raise RuntimeError(errText)

    flags = flags if flags is not None else ImportFlags()
    if flags.import_uuid is None:
        # TODO(getsentry/team-ospo#190): Previous efforts to use a dataclass here ran afoul of
        # pydantic playing poorly with them. May be worth investigating this again.
        flags = flags._replace(import_uuid=uuid4().hex)

    deps = dependencies()
    user_model_name = get_model_name(User)
    org_auth_token_model_name = get_model_name(OrgAuthToken)
    org_member_model_name = get_model_name(OrganizationMember)
    org_model_name = get_model_name(Organization)

    # TODO(getsentry#team-ospo/190): We need to handle `OrgAuthToken`s last, because they may need
    # to mint new tokens in case of a collision, and we need accurate org slugs to do that. Org
    # slugs may themselves altered by the import process in the event of collision, and require a
    # post-import RPC call to the `organization_provisioning_service` to properly handle. Because we
    # can't do this RPC call from inside of a transaction, we must take the following approach:
    #
    #   1. Import all models EXCEPT `OrgAuthToken` in normal reverse dependency order. If we are
    #      performing this import in `MONOLITH` mode, do this atomically to minimize data corruption
    #      risk.
    #   2. Make the `bulk_create_organization_slugs` RPC call to update the slugs to globally
    #      correct values.
    #   3. Import `OrgAuthToken`s, now assured that all slugs they use will be correct.
    #
    # Needless to say, there is probably a better way to do this, but we'll use this hacky
    # workaround for now to enable forward progress.
    deferred_org_auth_tokens = None

    # TODO(getsentry#team-ospo/190): Reading the entire export into memory as a string is quite
    # wasteful - in the future, we should explore chunking strategies to enable a smaller memory
    # footprint when processing super large (>100MB) exports.
    content = (
        decrypt_encrypted_tarball(src, decryptor)
        if decryptor is not None
        else src.read().decode("utf-8")
    )
    filters = []
    if filter_by is not None:
        filters.append(filter_by)

        # `sentry.Email` models don't have any explicit dependencies on `sentry.User`, so we need to
        # find and record them manually.
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
    def yield_json_models(content) -> Iterator[Tuple[NormalizedModelName, str]]:
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

    # A wrapper for some immutable state we need when performing a single `do_write().
    @dataclass(frozen=True)
    class ImportWriteContext:
        scope: RpcImportScope
        flags: RpcImportFlags
        filter_by: list[RpcFilter]
        dependencies: dict[NormalizedModelName, ModelRelations]

    # Perform the write of a single model.
    def do_write(
        import_write_context: ImportWriteContext,
        pk_map: PrimaryKeyMap,
        model_name: NormalizedModelName,
        json_data: json.JSONData,
    ) -> None:
        model_relations = import_write_context.dependencies.get(model_name)
        if not model_relations:
            return

        dep_models = {get_model_name(d) for d in model_relations.get_dependencies_for_relocation()}
        import_by_model = ImportExportService.get_importer_for_model(model_relations.model)
        model_name_str = str(model_name)
        result = import_by_model(
            model_name=model_name_str,
            scope=import_write_context.scope,
            flags=import_write_context.flags,
            filter_by=import_write_context.filter_by,
            pk_map=RpcPrimaryKeyMap.into_rpc(pk_map.partition(dep_models)),
            json_data=json_data,
        )

        if isinstance(result, RpcImportError):
            printer.echo(result.pretty(), err=True)
            if result.get_kind() == RpcImportErrorKind.IntegrityError:
                warningText = ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose"
                printer.echo(warningText, err=True)
            raise ImportingError(result)

        out_pk_map: PrimaryKeyMap = result.mapped_pks.from_rpc()
        pk_map.extend(out_pk_map)

        # If the model we just imported lives in the control silo, that means the import took place
        # over RPC. To ensure that we have an accurate view of the import result in both sides of
        # the RPC divide, we create a replica of the `ControlImportChunk` that successful import
        # would have generated in the calling region as well.
        if result.min_ordinal is not None and SiloMode.CONTROL in deps[model_name].silos:
            # If `min_ordinal` is not null, these values must not be either.
            assert result.max_ordinal is not None
            assert result.min_source_pk is not None
            assert result.max_source_pk is not None

            inserted = out_pk_map.partition({model_name}, {ImportKind.Inserted}).mapping[
                model_name_str
            ]
            existing = out_pk_map.partition({model_name}, {ImportKind.Existing}).mapping[
                model_name_str
            ]
            overwrite = out_pk_map.partition({model_name}, {ImportKind.Overwrite}).mapping[
                model_name_str
            ]
            control_import_chunk_replica = ControlImportChunkReplica(
                import_uuid=flags.import_uuid,
                model=model_name_str,
                # TODO(getsentry/team-ospo#190): The next two fields assume the entire model is
                # being imported in a single call; we may change this in the future.
                min_ordinal=result.min_ordinal,
                max_ordinal=result.max_ordinal,
                min_source_pk=result.min_source_pk,
                max_source_pk=result.max_source_pk,
                min_inserted_pk=result.min_inserted_pk,
                max_inserted_pk=result.max_inserted_pk,
                inserted_map={k: v[0] for k, v in inserted.items()},
                existing_map={k: v[0] for k, v in existing.items()},
                overwrite_map={k: v[0] for k, v in overwrite.items()},
                inserted_identifiers={k: v[2] for k, v in inserted.items() if v[2] is not None},
            )
            control_import_chunk_replica.save()

    import_write_context = ImportWriteContext(
        scope=RpcImportScope.into_rpc(scope),
        flags=RpcImportFlags.into_rpc(flags),
        filter_by=[RpcFilter.into_rpc(f) for f in filters],
        dependencies=deps,
    )

    # Extract some write logic into its own internal function, so that we may call it irrespective
    # of how we do atomicity: on a per-model (if using multiple dbs) or global (if using a single
    # db) basis.
    def do_writes(pk_map: PrimaryKeyMap) -> None:
        nonlocal deferred_org_auth_tokens, import_write_context

        for model_name, json_data in yield_json_models(content):
            if model_name == org_auth_token_model_name:
                deferred_org_auth_tokens = json_data
                continue

            do_write(import_write_context, pk_map, model_name, json_data)

    # Resolves slugs for all imported organization models via the PrimaryKeyMap and reconciles
    # their slug globally via control silo by issuing a slug update.
    def resolve_org_slugs_from_pk_map(pk_map: PrimaryKeyMap):
        from sentry.services.organization import organization_provisioning_service

        org_pk_mapping = pk_map.mapping[str(org_model_name)]
        if not org_pk_mapping:
            return

        org_ids_and_slugs: set[tuple[int, str]] = set()
        for old_primary_key in org_pk_mapping:
            org_id, _, org_slug = org_pk_mapping[old_primary_key]
            org_ids_and_slugs.add((org_id, org_slug or ""))

        if len(org_ids_and_slugs) > 0:
            organization_provisioning_service.bulk_create_organization_slugs(
                org_ids_and_slugs=org_ids_and_slugs
            )

    pk_map = PrimaryKeyMap()
    if SiloMode.get_current_mode() == SiloMode.MONOLITH and not is_split_db():
        with unguarded_write(using="default"), transaction.atomic(using="default"):
            if scope == ImportScope.Global:
                confirmed = printer.confirm(
                    """Proceeding with this operation will irrecoverably delete all existing
                    low-volume data - are you sure want to continue?"""
                )
                if not confirmed:
                    printer.echo("Import cancelled.")
                    return

                try:
                    _clear_model_tables_before_import()
                except DatabaseError as e:
                    printer.echo("Database could not be reset before importing")
                    raise e
            do_writes(pk_map)
    else:
        do_writes(pk_map)

    resolve_org_slugs_from_pk_map(pk_map)

    if deferred_org_auth_tokens:
        do_write(import_write_context, pk_map, org_auth_token_model_name, deferred_org_auth_tokens)


def import_in_user_scope(
    src: BinaryIO,
    *,
    decryptor: Decryptor | None = None,
    flags: ImportFlags | None = None,
    user_filter: set[str] | None = None,
    printer: Printer,
):
    """
    Perform an import in the `User` scope, meaning that only models with `RelocationScope.User` will
    be imported from the provided `src` file.

    The `user_filter` argument allows imports to be filtered by username. If the argument is set to
    `None`, there is no filtering, meaning all encountered users are imported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _import(
        src,
        ImportScope.User,
        decryptor=decryptor,
        flags=flags,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def import_in_organization_scope(
    src: BinaryIO,
    *,
    decryptor: Decryptor | None = None,
    flags: ImportFlags | None = None,
    org_filter: set[str] | None = None,
    printer: Printer,
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
        decryptor=decryptor,
        flags=flags,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        printer=printer,
    )


def import_in_config_scope(
    src: BinaryIO,
    *,
    decryptor: Decryptor | None = None,
    flags: ImportFlags | None = None,
    user_filter: set[str] | None = None,
    printer: Printer,
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
        decryptor=decryptor,
        flags=flags,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def import_in_global_scope(
    src: BinaryIO,
    *,
    decryptor: Decryptor | None = None,
    flags: ImportFlags | None = None,
    printer: Printer,
):
    """
    Perform an import in the `Global` scope, meaning that all models will be imported from the
    provided source file. Because a `Global` import is really only useful when restoring to a fresh
    Sentry instance, some behaviors in this scope are different from the others. In particular,
    superuser privileges are not sanitized. This method can be thought of as a "pure"
    backup/restore, simply serializing and deserializing a (partial) snapshot of the database state.
    """

    return _import(
        src,
        ImportScope.Global,
        decryptor=decryptor,
        flags=flags,
        printer=printer,
    )
