from __future__ import annotations

import io

# We have to use the default JSON interface to enable pretty-printing on export. When loading JSON,
# we still use the one from `sentry.utils`, imported as `sentry_json` below.
import json as builtin_json  # noqa: S003
from abc import ABC, abstractmethod
from typing import IO

import orjson

from sentry.backup.crypto import Encryptor, EncryptorDecryptorPair, create_encrypted_export_tarball
from sentry.backup.dependencies import (
    ImportKind,
    NormalizedModelName,
    PrimaryKeyMap,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import Filter, Printer
from sentry.backup.scopes import ExportScope
from sentry.backup.services.import_export.model import (
    RpcExportError,
    RpcExportOk,
    RpcExportScope,
    RpcFilter,
    RpcPrimaryKeyMap,
)
from sentry.backup.services.import_export.service import ImportExportService, import_export_service
from sentry.silo.base import SiloMode

__all__ = (
    "ExportingError",
    "export_in_user_scope",
    "export_in_organization_scope",
    "export_in_config_scope",
    "export_in_global_scope",
)


class ExportingError(Exception):
    def __init__(self, context: RpcExportError) -> None:
        self.context = context


class ExportCheckpointerError(Exception):
    pass


class ExportCheckpointer(ABC):
    """
    For very large exports, the exporting environment may fall over half-way through the process:
    the thread running it may hit some timeout, or it may OOM, or fail for some other ephemeral
    reason. To help in such situations, we'd like an API for saving "checkpoints" during the export.

    This class provides per-model checkpointing support for exports. Since there is a topologically
    sorted order of models being exported, as we move through this list, we can save the exported
    JSON for each kind of model in order to some stable media (disk, GCP, etc). If there is a
    failure late in the export process, when it is retried, the exporter can check if that
    particular model already exists in the checkpointer's cache, thereby avoiding redoing the work
    of pulling the models from the database, processing them, etc. This ensures that in most retry
    situations, we can quickly "re-ingest" already-exported models in memory and pick up where we
    left off.
    """

    def _parse_cached_json(self, json_data: bytes) -> RpcExportOk | None:
        max_pk = 0
        pk_map = PrimaryKeyMap()
        models = orjson.loads(json_data)
        for model in models:
            model_name = model.get("model", None)
            pk = model.get("pk", None)
            if model_name is None or pk is None:
                raise ExportCheckpointerError("Improperly formatted entry")

            pk_map.insert(model_name, pk, pk, ImportKind.Inserted)
            if pk > max_pk:
                max_pk = pk

        return RpcExportOk(
            mapped_pks=RpcPrimaryKeyMap.into_rpc(pk_map), max_pk=max_pk, json_data=json_data
        )

    @abstractmethod
    def get(self, model_name: NormalizedModelName) -> RpcExportOk | None:
        pass

    @abstractmethod
    def add(self, model_name: NormalizedModelName, json_data: str) -> None:
        pass


class NoopExportCheckpointer(ExportCheckpointer):
    """
    A noop checkpointer - that is, it doesn't write or read any checkpoints, always returning None.
    This means that no checkpointing ever occurs.
    """

    def __init__(self, crypto: EncryptorDecryptorPair | None, printer: Printer):
        pass

    def get(self, model_name: NormalizedModelName) -> RpcExportOk | None:
        return None

    def add(self, model_name: NormalizedModelName, json_data: str) -> None:
        return None


def _export(
    dest: IO[bytes],
    scope: ExportScope,
    *,
    encryptor: Encryptor | None = None,
    indent: int = 2,
    filter_by: Filter | None = None,
    printer: Printer,
    checkpointer: ExportCheckpointer | None = None,
):
    """
    Exports core data for the Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain
    combinations of input parameters that should not be used together. Instead, use one of the other
    wrapper functions in this file, named `export_in_XXX_scope()`.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization
    from sentry.models.organizationmember import OrganizationMember
    from sentry.users.models.user import User

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        errText = "Exports must be run in REGION or MONOLITH instances only"
        printer.echo(errText, err=True)
        raise RuntimeError(errText)

    cache = checkpointer if checkpointer is not None else NoopExportCheckpointer(None, printer)
    json_export = []
    pk_map = PrimaryKeyMap()
    allowed_relocation_scopes = scope.value
    filters = []
    if filter_by is not None:
        filters.append(filter_by)
        if filter_by.model == Organization:
            if filter_by.field != "slug":
                raise ValueError(
                    "Filter arguments must only apply to `Organization`'s `slug` field"
                )

            org_pks = set(
                Organization.objects.filter(slug__in=filter_by.values).values_list("id", flat=True)
            )

            # Note: `user_id` can be NULL (for invited members that have not yet responded), but
            # this is okay, because `Filter`s constructor explicitly filters out `None` members
            # from the set.
            user_pks = set(
                OrganizationMember.objects.filter(organization_id__in=org_pks).values_list(
                    "user_id", flat=True
                )
            )
            filters.append(Filter(User, "pk", set(user_pks)))
        elif filter_by.model == User:
            if filter_by.field not in {"pk", "id", "username"}:
                raise ValueError("Filter arguments must only apply to `User`'s `username` field")
        else:
            raise ValueError("Filter arguments must only apply to `Organization` or `User` models")

    # TODO(getsentry/team-ospo#190): Another optimization opportunity to use a generator with ijson
    # # to print the JSON objects in a streaming manner.
    for model in sorted_dependencies():
        from sentry.db.models.base import BaseModel

        if not issubclass(model, BaseModel):
            continue

        possible_relocation_scopes = model.get_possible_relocation_scopes()
        includable = possible_relocation_scopes & allowed_relocation_scopes
        if not includable or model._meta.proxy:
            continue

        model_name = get_model_name(model)
        model_relations = dependencies().get(model_name)
        if not model_relations:
            continue

        dep_models = {get_model_name(d) for d in model_relations.get_dependencies_for_relocation()}
        export_by_model = ImportExportService.get_exporter_for_model(model)
        cached_result = cache.get(model_name)
        result = (
            cached_result
            if cached_result is not None
            else export_by_model(
                export_model_name=str(model_name),
                scope=RpcExportScope.into_rpc(scope),
                from_pk=0,
                filter_by=[RpcFilter.into_rpc(f) for f in filters],
                pk_map=RpcPrimaryKeyMap.into_rpc(pk_map.partition(dep_models)),
                indent=indent,
            )
        )

        if isinstance(result, RpcExportError):
            printer.echo(result.pretty(), err=True)
            raise ExportingError(result)

        pk_map.extend(result.mapped_pks.from_rpc())
        json_models = orjson.loads(result.json_data)
        if cached_result is None:
            cache.add(model_name, json_models)

        # TODO(getsentry/team-ospo#190): Since the structure of this data is very predictable (an
        # array of serialized model objects), we could probably avoid re-ingesting the JSON string
        # as a future optimization.
        for json_model in json_models:
            json_export.append(json_model)

    # If no `encryptor` argument was passed in, this is an unencrypted export, so we can just dump
    # the JSON into the `dest` file and exit early.
    if encryptor is None:
        dest_wrapper = io.TextIOWrapper(dest, encoding="utf-8", newline="")
        builtin_json.dump(json_export, dest_wrapper, indent=indent)
        dest_wrapper.detach()
        return

    dest.write(create_encrypted_export_tarball(json_export, encryptor).getvalue())


def export_in_user_scope(
    dest: IO[bytes],
    *,
    encryptor: Encryptor | None = None,
    user_filter: set[str] | None = None,
    indent: int = 2,
    printer: Printer,
    checkpointer: ExportCheckpointer | None = None,
):
    """
    Perform an export in the `User` scope, meaning that only models with `RelocationScope.User` will
    be exported from the provided `dest` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.users.models.user import User

    return _export(
        dest,
        ExportScope.User,
        encryptor=encryptor,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        indent=indent,
        printer=printer,
        checkpointer=checkpointer,
    )


def export_in_organization_scope(
    dest: IO[bytes],
    *,
    encryptor: Encryptor | None = None,
    org_filter: set[str] | None = None,
    indent: int = 2,
    printer: Printer,
    checkpointer: ExportCheckpointer | None = None,
):
    """
    Perform an export in the `Organization` scope, meaning that only models with
    `RelocationScope.User` or `RelocationScope.Organization` will be exported from the provided
    `dest` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization

    return _export(
        dest,
        ExportScope.Organization,
        encryptor=encryptor,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        indent=indent,
        printer=printer,
        checkpointer=checkpointer,
    )


def export_in_config_scope(
    dest: IO[bytes],
    *,
    encryptor: Encryptor | None = None,
    indent: int = 2,
    printer: Printer,
    checkpointer: ExportCheckpointer | None = None,
):
    """
    Perform an export in the `Config` scope, meaning that only models directly related to the global
    configuration and administration of an entire Sentry instance will be exported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.users.models.user import User

    return _export(
        dest,
        ExportScope.Config,
        encryptor=encryptor,
        filter_by=Filter(User, "pk", import_export_service.get_all_globally_privileged_users()),
        indent=indent,
        printer=printer,
        checkpointer=checkpointer,
    )


def export_in_global_scope(
    dest: IO[bytes],
    *,
    encryptor: Encryptor | None = None,
    indent: int = 2,
    printer: Printer,
    checkpointer: ExportCheckpointer | None = None,
):
    """
    Perform an export in the `Global` scope, meaning that all models will be exported from the
    provided source file.
    """
    return _export(
        dest,
        ExportScope.Global,
        encryptor=encryptor,
        indent=indent,
        printer=printer,
        checkpointer=checkpointer,
    )
