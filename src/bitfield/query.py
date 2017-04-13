from __future__ import absolute_import

from bitfield.types import Bit, BitHandler


class BitQueryLookupWrapper(object):
    def __init__(self, alias, column, bit):
        self.table_alias = alias
        self.column = column
        self.bit = bit

    def as_sql(self, qn, connection=None):
        """
        Create the proper SQL fragment. This inserts something like
        "(T0.flags & value) != 0".

        This will be called by Where.as_sql()
        """
        if self.bit:
            return ("(%s.%s | %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask),
                    [])
        return ("(%s.%s & %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask),
                [])


try:
    # Django 1.7+
    from django.db.models.lookups import Exact

    class BitQueryLookupWrapper(Exact):  # NOQA
        def process_lhs(self, qn, connection, lhs=None):
            lhs_sql, params = super(BitQueryLookupWrapper, self).process_lhs(
                qn, connection, lhs)
            if self.rhs:
                lhs_sql = lhs_sql + ' & %s'
            else:
                lhs_sql = lhs_sql + ' | %s'
            params.extend(self.get_db_prep_lookup(self.rhs, connection)[1])
            return lhs_sql, params

        def get_db_prep_lookup(self, value, connection, prepared=False):
            v = value.mask if isinstance(value, (BitHandler, Bit)) else value
            return super(BitQueryLookupWrapper, self).get_db_prep_lookup(v, connection)

        def get_prep_lookup(self):
            return self.rhs

except ImportError:
    pass


class BitQuerySaveWrapper(BitQueryLookupWrapper):
    def as_sql(self, qn, connection):
        """
        Create the proper SQL fragment. This inserts something like
        "(T0.flags & value) != 0".

        This will be called by Where.as_sql()
        """
        engine = connection.settings_dict['ENGINE'].rsplit('.', -1)[-1]
        if engine.startswith('postgres'):
            XOR_OPERATOR = '#'
        elif engine.startswith('sqlite'):
            raise NotImplementedError
        else:
            XOR_OPERATOR = '^'

        if self.bit:
            return ("%s.%s | %d" % (qn(self.table_alias), qn(self.column), self.bit.mask),
                    [])
        return ("%s.%s %s %d" % (qn(self.table_alias), qn(self.column), XOR_OPERATOR, self.bit.mask),
                [])
