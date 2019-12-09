from __future__ import absolute_import

from bitfield.types import Bit, BitHandler

from django.db.models.lookups import Exact

# from django.db.models.lookups import Lookup


class BitQueryLookupWrapper(Exact):
    def process_lhs(self, qn, connection, lhs=None):
        lhs_sql, params = super(BitQueryLookupWrapper, self).process_lhs(qn, connection, lhs)
        if self.rhs:
            lhs_sql = lhs_sql + " & %s"
        else:
            lhs_sql = lhs_sql + " | %s"
        params.extend(self.process_rhs(qn, connection)[1])
        return lhs_sql, params

    def get_db_prep_lookup(self, value, connection, prepared=False):
        v = value.mask if isinstance(value, (BitHandler, Bit)) else value
        return super(BitQueryLookupWrapper, self).get_db_prep_lookup(v, connection)

    def get_prep_lookup(self):
        return self.rhs
