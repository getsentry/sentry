from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.utils.services import Service

if TYPE_CHECKING:
    from sentry.models import Group, Project, Rule


class RuleHistoryBackend(Service):
    """
    This backend is an interface for storing and retrieving issue alert fire history.
    """

    __all__ = ("record",)

    def record(self, project: Project, rule: Rule, group: Group) -> None:
        """
        Records an instance of an issue alert being fired for a given group.
        """
        raise NotImplementedError
