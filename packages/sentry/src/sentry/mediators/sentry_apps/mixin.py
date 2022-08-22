from typing import Set


class SentryAppMixin:
    def get_schema_types(self) -> Set[str]:
        return {element["type"] for element in (self.schema or {}).get("elements", [])}
