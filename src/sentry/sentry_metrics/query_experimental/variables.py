from .transform import QueryTransform
from .types import Column, InvalidMetricsQuery, SeriesQuery, VariableMap


def map_variables(query: SeriesQuery, mapping: VariableMap) -> SeriesQuery:
    """
    Map variables in a series query to columns.
    """

    transform = VariableTransform(mapping)
    return transform.visit(query)


class VariableTransform(QueryTransform):
    def __init__(self, mapping: VariableMap):
        self.mapping = mapping

    def _visit_column(self, column: Column) -> Column:
        if not column.name.startswith("$"):
            return column

        name = column.name[1:]
        if name not in self.mapping:
            raise InvalidMetricsQuery(f"Variable `{name}` not defined")

        return self.mapping[name]
