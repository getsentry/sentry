# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections import defaultdict
from enum import Enum, unique
from typing import Dict, Literal, Optional, Set, Tuple, Union

from pydantic import Field, StrictInt, StrictStr
from typing_extensions import Annotated

from sentry.backup.dependencies import (
    ImportKind,
    NormalizedModelName,
    PrimaryKeyMap,
    get_model,
    get_model_name,
)
from sentry.backup.findings import Finding, InstanceID
from sentry.backup.helpers import Filter
from sentry.backup.scopes import ExportScope
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
    values: Set[Union[StrictStr, StrictInt]]

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


class RpcPrimaryKeyMap(RpcModel):
    """
    Shadows `sentry.backup.dependencies.PrimaryKeyMap` for the purpose of passing it over an RPC boundary. The primary difference between this class and the one it shadows is that the original `PrimaryKeyMap` uses `defaultdict` for ergonomics purposes, whereas this one uses a regular dict but provides no mutation methods - it is only intended for data interchange, and should be converted to and from `PrimaryKeyMap` immediately on either side of the RPC call.
    """

    # Pydantic duplicates global default models on a per-instance basis, so using `{}` here is safe.
    mapping: Dict[str, Dict[int, Tuple[int, ImportKind, Optional[str]]]] = {}

    def from_rpc(self) -> PrimaryKeyMap:
        pk_map = PrimaryKeyMap()
        pk_map.mapping = defaultdict(dict, self.mapping)
        return pk_map

    @classmethod
    def into_rpc(cls, base_map: PrimaryKeyMap) -> "RpcPrimaryKeyMap":
        converted = cls()
        converted.mapping = dict(base_map.mapping)
        return converted


class RpcExportScope(str, Enum):
    """
    Scope values are rendered as strings for JSON interchange, but can easily be mapped back to their set-based values when necessary.
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
    left_pk: Optional[int] = None
    right_pk: Optional[int] = None
    reason: str = ""

    def get_kind(self) -> RpcExportErrorKind:
        return RpcExportErrorKind(self.kind)

    def pretty(self) -> str:
        return f"RpcExportError(\n\tkind: {self.get_kind()},{self._pretty_inner()}\n)"


RpcExportResult = Annotated[Union[RpcExportOk, RpcExportError], Field(discriminator="is_err")]
