from __future__ import absolute_import

from bitfield.types import Bit, BitHandler

from django.db.models.lookups import Exact


class BitQueryExactLookupStub(Exact):
    def get_db_prep_lookup(self, value, connection, prepared=False):
        if isinstance(value, (BitHandler, Bit)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit, BitHandler")
        return super(BitQueryExactLookupStub, self).get_db_prep_lookup(value, connection)

    def get_prep_lookup(self):
        if isinstance(self.rhs, (Bit,)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit")
        return self.rhs
