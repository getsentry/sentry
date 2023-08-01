from .transform import QueryTransform
from .types import Expression, InvalidMetricsQuery, SeriesQuery, Variable, VariableMap


def map_variables(query: SeriesQuery, mapping: VariableMap) -> SeriesQuery:
    """
    Map variables in a series query to columns.
    """

    transform = VariableTransform(mapping)
    return transform.visit(query)


class VariableTransform(QueryTransform):
    def __init__(self, mapping: VariableMap):
        self.mapping = mapping

    def _visit_variable(self, variable: Variable) -> Expression:
        if variable.name not in self.mapping:
            raise InvalidMetricsQuery(f"Variable `{variable.name}` not defined")

        return self.mapping[variable.name]
