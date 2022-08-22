from django.db.models.lookups import Exact

from bitfield.types import Bit, BitHandler


class BitQueryExactLookupStub(Exact):
    def get_db_prep_lookup(self, value, connection, prepared=False):
        if isinstance(value, (BitHandler, Bit)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit, BitHandler")
        return super().get_db_prep_lookup(value, connection)

    def get_prep_lookup(self):
        if isinstance(self.rhs, (Bit,)):
            raise NotImplementedError("get_db_prep_lookup not supported for Bit")
        return self.rhs
