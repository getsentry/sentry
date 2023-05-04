from typing import Optional

from sentry.search.events.builder import QueryBuilder


class SpansIndexedQueryBuilder(QueryBuilder):
    requires_organization_condition = False

    def get_field_type(self, field: str) -> Optional[str]:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.exclusive_time"]:
            return "duration"

        return None
