from typing import Any

from . import column_family as column_family
from .table import Table

class Instance:
    def table(self, table_id: str, app_profile_id: str | None = None, **kwargs: Any) -> Table: ...

class Client:
    def __init__(self, project: str | None = ..., admin: bool = ..., **kwargs: Any) -> None: ...
    def instance(self, instance_id: str) -> Instance: ...
