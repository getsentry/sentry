from sentry.api.event_search import parse_search_query
from sentry.discover.arithmetic import parse_arithmetic


class MetricsTranspiler:
    def __init__(self, field, filters):
        self.field = field
        self.filters = filters

    def transpile_fields(self):
        parse_arithmetic(self.field)

    def transpile_filters(self):
        parse_search_query(self.filters)
