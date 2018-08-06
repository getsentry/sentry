from __future__ import absolute_import


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
            return ("(%s.%s | %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask), [])
        return ("(%s.%s & %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask), [])


try:
    # Django 1.7+
    from django.db.models.lookups import BuiltinLookup

    class BitQueryLookupWrapper(BuiltinLookup):  # NOQA
        def as_sql(self, compiler, connection):
            """
            Create the proper SQL fragment. This inserts something like
            "(T0.flags & value) != 0".

            This will be called by Where.as_sql()
            """
            qn = connection.ops.quote_name
            if self.bit:
                return ("(%s.%s | %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask), [])
            return ("(%s.%s & %d)" % (qn(self.table_alias), qn(self.column), self.bit.mask), [])

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
            return ("%s.%s | %d" % (qn(self.table_alias), qn(self.column), self.bit.mask), [])
        return (
            "%s.%s %s %d" % (qn(self.table_alias), qn(self.column), XOR_OPERATOR, self.bit.mask), []
        )
