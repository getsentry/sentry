from __future__ import annotations

import io
import tarfile
from typing import BinaryIO, Type

import click
from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.db.models.base import Model

from sentry.backup.dependencies import (
    PrimaryKeyMap,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import Filter
from sentry.backup.scopes import ExportScope
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportScope,
    RpcFilter,
    RpcPrimaryKeyMap,
)
from sentry.services.hybrid_cloud.import_export.service import (
    ImportExportService,
    import_export_service,
)
from sentry.silo.base import SiloMode
from sentry.utils import json

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


def _export(
    dest,
    scope: ExportScope,
    *,
    encrypt_with: BinaryIO | None = None,
    indent: int = 2,
    filter_by: Filter | None = None,
    printer=click.echo,
):
    """
    Exports core data for the Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain combinations of input parameters that should not be used together. Instead, use one of the other wrapper functions in this file, named `export_in_XXX_scope()`.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.user import User

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        errText = "Exports must be run in REGION or MONOLITH instances only"
        printer(errText, err=True)
        raise RuntimeError(errText)

    json_export = []
    pk_map = PrimaryKeyMap()
    allowed_relocation_scopes = scope.value
    filters = []
    if filter_by is not None:
        filters.append(filter_by)
        if filter_by.model == Organization:
            if filter_by.field not in {"pk", "id", "slug"}:
                raise ValueError(
                    "Filter arguments must only apply to `Organization`'s `slug` field"
                )

            org_pks = set(
                Organization.objects.filter(slug__in=filter_by.values).values_list("id", flat=True)
            )
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

    def get_exporter_for_model(model: Type[Model]):
        if SiloMode.CONTROL in model._meta.silo_limit.modes:  # type: ignore
            return import_export_service.export_by_model
        return ImportExportService.get_local_implementation().export_by_model  # type: ignore

    # TODO(getsentry/team-ospo#190): Another optimization opportunity to use a generator with ijson # to print the JSON objects in a streaming manner.
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
        export_by_model = get_exporter_for_model(model)
        result = export_by_model(
            model_name=str(model_name),
            scope=RpcExportScope.into_rpc(scope),
            from_pk=0,
            filter_by=[RpcFilter.into_rpc(f) for f in filters],
            pk_map=RpcPrimaryKeyMap.into_rpc(pk_map.partition(dep_models)),
            indent=indent,
        )

        if isinstance(result, RpcExportError):
            printer(result.pretty(), err=True)
            raise ExportingError(result)

        pk_map.extend(result.mapped_pks.from_rpc())

        # TODO(getsentry/team-ospo#190): Since the structure of this data is very predictable (an
        # array of serialized model objects), we could probably avoid re-ingesting the JSON string
        # as a future optimization.
        for json_model in json.loads(result.json_data):
            json_export.append(json_model)

    # If no `encrypt_with` argument was passed in, this is an unencrypted export, so we can just
    # dump the JSON into the `dest` file and exit early.
    if encrypt_with is None:
        dest_wrapper = io.TextIOWrapper(dest, encoding="utf-8", newline="")
        json.dump(json_export, dest_wrapper)
        dest_wrapper.detach()
        return

    # Generate a new DEK (data encryption key), and use that DEK to encrypt the JSON being exported.
    pem = encrypt_with.read()
    data_encryption_key = Fernet.generate_key()
    backup_encryptor = Fernet(data_encryption_key)
    encrypted_json_export = backup_encryptor.encrypt(json.dumps(json_export).encode("utf-8"))

    # Encrypt the newly minted DEK using symmetric public key encryption.
    dek_encryption_key = serialization.load_pem_public_key(pem, default_backend())
    sha256 = hashes.SHA256()
    mgf = padding.MGF1(algorithm=sha256)
    oaep_padding = padding.OAEP(mgf=mgf, algorithm=sha256, label=None)
    encrypted_dek = dek_encryption_key.encrypt(data_encryption_key, oaep_padding)  # type: ignore

    # Generate a tarball with 3 files:
    #
    #   1. The DEK we minted, name "data.key".
    #   2. The public key we used to encrypt that DEK, named "key.pub".
    #   3. The exported JSON data, encrypted with that DEK, named "export.json".
    #
    # The upshot: to decrypt the exported JSON data, you need the plaintext (decrypted) DEK. But to
    # decrypt the DEK, you need the private key associated with the included public key, which
    # you've hopefully kept in a safe, trusted location.
    #
    # Note that the supplied file names are load-bearing - ex, changing to `data.key` to `foo.key`
    # risks breaking assumptions that the decryption side will make on the other end!
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
        json_info = tarfile.TarInfo("export.json")
        json_info.size = len(encrypted_json_export)
        tar.addfile(json_info, fileobj=io.BytesIO(encrypted_json_export))
        key_info = tarfile.TarInfo("data.key")
        key_info.size = len(encrypted_dek)
        tar.addfile(key_info, fileobj=io.BytesIO(encrypted_dek))
        pub_info = tarfile.TarInfo("key.pub")
        pub_info.size = len(pem)
        tar.addfile(pub_info, fileobj=io.BytesIO(pem))
    dest.write(tar_buffer.getvalue())


def export_in_user_scope(
    dest,
    *,
    encrypt_with: BinaryIO | None = None,
    user_filter: set[str] | None = None,
    indent: int = 2,
    printer=click.echo,
):
    """
    Perform an export in the `User` scope, meaning that only models with `RelocationScope.User` will
    be exported from the provided `dest` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _export(
        dest,
        ExportScope.User,
        encrypt_with=encrypt_with,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        indent=indent,
        printer=printer,
    )


def export_in_organization_scope(
    dest,
    *,
    encrypt_with: BinaryIO | None = None,
    org_filter: set[str] | None = None,
    indent: int = 2,
    printer=click.echo,
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
        encrypt_with=encrypt_with,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        indent=indent,
        printer=printer,
    )


def export_in_config_scope(
    dest,
    *,
    encrypt_with: BinaryIO | None = None,
    indent: int = 2,
    printer=click.echo,
):
    """
    Perform an export in the `Config` scope, meaning that only models directly related to the global
    configuration and administration of an entire Sentry instance will be exported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _export(
        dest,
        ExportScope.Config,
        encrypt_with=encrypt_with,
        filter_by=Filter(User, "pk", import_export_service.get_all_globally_privileged_users()),
        indent=indent,
        printer=printer,
    )


def export_in_global_scope(
    dest,
    *,
    encrypt_with: BinaryIO | None = None,
    indent: int = 2,
    printer=click.echo,
):
    """
    Perform an export in the `Global` scope, meaning that all models will be exported from the
    provided source file.
    """
    return _export(
        dest,
        ExportScope.Global,
        encrypt_with=encrypt_with,
        indent=indent,
        printer=printer,
    )
