# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections import defaultdict
from enum import Enum, unique
from typing import Annotated, Any, Literal, Union

from pydantic import Field, StrictInt, StrictStr

from sentry.backup.dependencies import (
    ImportKind,
    NormalizedModelName,
    PrimaryKeyMap,
    get_model,
    get_model_name,
)
from sentry.backup.findings import Finding, InstanceID
from sentry.backup.helpers import Filter, ImportFlags
from sentry.backup.scopes import ExportScope, ImportScope
from sentry.services.hybrid_cloud import RpcModel


class RpcFilter(RpcModel):
    """
    Shadows `sentry.backup.helpers.Filter` for the purpose of passing it over an RPC boundary.
    """

    model_name: str
    field: str

    # While on the original `Filter` type these can be any kind, in practice we only use integers or
    # strings here.
    #
    # TODO(getsentry/team-ospo#190): Unify with the base filter type.
    values: set[StrictStr | StrictInt]

    def from_rpc(self) -> Filter:
        model = get_model(NormalizedModelName(self.model_name))
        if model is None:
            raise ValueError("model not found")

        return Filter(model, self.field, self.values)

    @classmethod
    def into_rpc(cls, base_filter: Filter) -> "RpcFilter":
        return cls(
            model_name=str(get_model_name(base_filter.model)),
            field=base_filter.field,
            values=base_filter.values,
        )


class RpcPrimaryKeyMapEntry(RpcModel):
    new_pk: int
    kind: ImportKind
    slug: str | None


class RpcPrimaryKeyMap(RpcModel):
    """
    Shadows `sentry.backup.dependencies.PrimaryKeyMap` for the purpose of passing it over an RPC
    boundary. The primary difference between this class and the one it shadows is that the original
    `PrimaryKeyMap` uses `defaultdict` for ergonomics purposes, whereas this one uses a regular dict
    but provides no mutation methods - it is only intended for data interchange, and should be
    converted to and from `PrimaryKeyMap` immediately on either side of the RPC call.
    """

    mapping: dict[str, dict[int, RpcPrimaryKeyMapEntry]]

    def from_rpc(self) -> PrimaryKeyMap:
        converted = {
            model_name: {
                pk: (entry.new_pk, entry.kind, entry.slug) for (pk, entry) in pk_entries.items()
            }
            for (model_name, pk_entries) in self.mapping.items()
        }
        pk_map = PrimaryKeyMap()
        pk_map.mapping = defaultdict(dict, converted)
        return pk_map

    @classmethod
    def into_rpc(cls, base_map: PrimaryKeyMap) -> "RpcPrimaryKeyMap":
        converted = {
            model_name: {
                pk: RpcPrimaryKeyMapEntry(new_pk=t[0], kind=t[1], slug=t[2])
                for (pk, t) in pk_entries.items()
            }
            for (model_name, pk_entries) in base_map.mapping.items()
        }
        return cls(mapping=converted)


class RpcImportScope(str, Enum):
    """
    Scope values are rendered as strings for JSON interchange, but can easily be mapped back to their set-based values when necessary.
    """

    User = "User"
    Organization = "Organization"
    Config = "Config"
    Global = "Global"

    def from_rpc(self) -> ImportScope:
        return ImportScope[self.name]

    @classmethod
    def into_rpc(cls, base_scope: ImportScope) -> "RpcImportScope":
        return RpcImportScope[base_scope.name]


class RpcImportFlags(RpcModel):
    """
    Shadows `sentry.backup.helpers.ImportFlags` for the purpose of passing it over an RPC boundary.
    """

    merge_users: bool = False
    overwrite_configs: bool = False
    import_uuid: str | None = None

    def from_rpc(self) -> ImportFlags:
        return ImportFlags(
            merge_users=self.merge_users,
            overwrite_configs=self.overwrite_configs,
            import_uuid=self.import_uuid,
        )

    @classmethod
    def into_rpc(cls, base_flags: ImportFlags) -> "RpcImportFlags":
        return cls(
            merge_users=base_flags.merge_users,
            overwrite_configs=base_flags.overwrite_configs,
            import_uuid=base_flags.import_uuid,
        )


# Using strings, rather than `auto()` integers, makes this more (though not completely) robust to
# version skew.
@unique
class RpcImportErrorKind(str, Enum):
    Unknown = "Unknown"

    DatabaseError = "DatabaseError"
    DeserializationFailed = "DeserializationFailed"
    IncorrectSiloModeForModel = "IncorrectSiloModeForModel"
    IntegrityError = "IntegrityError"
    MissingImportUUID = "MissingImportUUID"
    UnknownModel = "UnknownModel"
    UnexpectedModel = "UnexpectedModel"
    UnspecifiedScope = "UnspecifiedScope"
    ValidationError = "ValidationError"


class RpcImportError(RpcModel, Finding):
    """
    A Pydantic and RPC friendly error container that also inherits from the base `Finding` class.
    """

    is_err: Literal[True] = True
    kind: RpcImportErrorKind = RpcImportErrorKind.Unknown

    # Include fields from `Finding` in this `RpcModel` derivative.
    on: InstanceID
    left_pk: int | None = None
    right_pk: int | None = None
    reason: str = ""

    def get_kind(self) -> RpcImportErrorKind:
        return RpcImportErrorKind(self.kind)

    def pretty(self) -> str:
        return f"RpcImportError(\n    kind: {self.get_kind().value},{self._pretty_inner()}\n)"

    def to_dict(self) -> dict[str, Any]:
        d = dict(self)
        del d["is_err"]
        return d


class RpcImportOk(RpcModel):
    """
    Information about a successful import: the mapping of old pks to new ones, the maximum pk
    imported, and the total number of imported models.
    """

    is_err: Literal[False] = False
    mapped_pks: RpcPrimaryKeyMap
    min_ordinal: int | None = None
    max_ordinal: int | None = None
    min_source_pk: int | None = None
    max_source_pk: int | None = None
    min_inserted_pk: int | None = None
    max_inserted_pk: int | None = None


RpcImportResult = Annotated[Union[RpcImportOk, RpcImportError], Field(discriminator="is_err")]


class RpcExportScope(str, Enum):
    """
    Scope values are rendered as strings for JSON interchange, but can easily be mapped back to
    their set-based values when necessary.
    """

    User = "User"
    Organization = "Organization"
    Config = "Config"
    Global = "Global"

    def from_rpc(self) -> ExportScope:
        return ExportScope[self.name]

    @classmethod
    def into_rpc(cls, base_scope: ExportScope) -> "RpcExportScope":
        return RpcExportScope[base_scope.name]


class RpcExportOk(RpcModel):
    """
    Information about a successful export: the mapping of old pks to new ones, the maximum pk
    exported, and the JSON string of the exported models.
    """

    is_err: Literal[False] = False
    mapped_pks: RpcPrimaryKeyMap
    max_pk: int = 0
    json_data: str = "[]"


# Using strings, rather than `auto()` integers, makes this more (though not completely) robust to
# version skew.
@unique
class RpcExportErrorKind(str, Enum):
    Unknown = "Unknown"

    IncorrectSiloModeForModel = "IncorrectSiloModeForModel"
    UnknownModel = "UnknownModel"
    UnexportableModel = "UnexportableModel"
    UnspecifiedScope = "UnspecifiedScope"


class RpcExportError(RpcModel, Finding):
    """
    A Pydantic and RPC friendly error container that also inherits from the base `Finding` class.
    """

    is_err: Literal[True] = True
    kind: RpcExportErrorKind = RpcExportErrorKind.Unknown

    # Include fields from `Finding` in this `RpcModel` derivative.
    on: InstanceID
    left_pk: int | None = None
    right_pk: int | None = None
    reason: str = ""

    def get_kind(self) -> RpcExportErrorKind:
        return RpcExportErrorKind(self.kind)

    def pretty(self) -> str:
        return f"RpcExportError(\n    kind: {self.get_kind().value},{self._pretty_inner()}\n)"

    def to_dict(self) -> dict[str, Any]:
        d = dict(self)
        del d["is_err"]
        return d


RpcExportResult = Annotated[Union[RpcExportOk, RpcExportError], Field(discriminator="is_err")]
