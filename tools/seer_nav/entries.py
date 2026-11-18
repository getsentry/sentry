"""The nav snapshot's entry shape, shared by the parser and the generator.

Conditions are JSON: `{"flag": name}`, `{"org": attribute}`, `{"deployment": kind}`,
`{"scope": permission}`, `{"unknown": source_expression}`, combined with `{"all": [...]}`,
`{"any": [...]}` and `{"not": cond}`. A missing condition means always shown.
"""

from __future__ import annotations

import dataclasses
from typing import Any

PROJECT_PLACEHOLDER = "<project>"
TEAM_PLACEHOLDER = "<team>"
CRUMB_SEPARATOR = " → "

Condition = dict[str, Any]


@dataclasses.dataclass(frozen=True)
class NavEntry:
    crumbs: str
    path: str
    when: Condition | None = None
    # Create forms and detail tabs reached from a nav page rather than the sidebar itself.
    sub_page: bool = False

    def to_dict(self) -> dict[str, Any]:
        """The entry as stored in the snapshot, leaving out fields at their defaults."""
        data: dict[str, Any] = {"crumbs": self.crumbs, "path": self.path}
        if self.when is not None:
            data["when"] = self.when
        if self.sub_page:
            data["sub_page"] = True
        return data
