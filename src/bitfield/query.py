from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models.lookups import Exact

from bitfield.types import Bit, BitHandler

if TYPE_CHECKING:
    from django.db.backends.base.base import BaseDatabaseWrapper
    from django.db.models.sql.compiler import _AsSqlType, _ParamT

    _ExactBase = Exact[object]
else:
    _ExactBase = Exact


class BitQueryExactLookupStub(_ExactBase):
    def get_db_prep_lookup(
        self, value: _ParamT, connection: BaseDatabaseWrapper, prepared: bool = False
    ) -> _AsSqlType:
        if isinstance(value, (BitHandler, Bit)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit, BitHandler")
        return super().get_db_prep_lookup(value, connection)

    def get_prep_lookup(self) -> object:
        if isinstance(self.rhs, (Bit,)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit")
        return self.rhs
