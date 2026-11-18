from __future__ import annotations

import bisect
from collections.abc import Callable, Mapping, ValuesView
from typing import TYPE_CHECKING, Any, TypeAlias

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.projects.services.project.model import RpcProject


OptionValue: TypeAlias = Any


class WellKnownProjectOption:
    def __init__(
        self,
        key: str,
        default: OptionValue = None,
        epoch_defaults: Mapping[int, OptionValue] | None = None,
    ) -> None:
        self.key = key
        self.default = default
        self.epoch_defaults = epoch_defaults
        self._epoch_default_list = sorted(epoch_defaults or ())

    def get_default(
        self, project: Project | RpcProject | int | None = None, epoch: int | None = None
    ) -> OptionValue:
        if self.epoch_defaults:
            if epoch is None:
                if project is None:
                    epoch = 1
                elif isinstance(project, int):
                    from sentry.models.options.project_option import get_option

                    epoch = get_option(project, "sentry:option-epoch") or 1
                else:
                    # ``project`` may be a Django ``Project`` or an ``RpcProject``; both
                    # support ``get_option``, which routes through the RPC service when
                    # called in a silo without direct DB access.
                    epoch = project.get_option("sentry:option-epoch") or 1
            # Find where in the ordered epoch list the project's epoch would go
            idx = bisect.bisect(self._epoch_default_list, epoch)
            if idx > 0:
                # Return the value corresponding to the highest epoch which doesn't exceed the
                # project epoch
                return self.epoch_defaults[self._epoch_default_list[idx - 1]]
        return self.default


class ProjectOptionsManager:
    """Project options used to be implemented in a relatively ad-hoc manner
    in the past.  The project manager still uses the functionality of the
    project model and just dispatches to it.

    Options can be used without declaring defaults, but if defaults are
    declared they are returned without having to define a default at the
    time of the option lookup.
    """

    def __init__(self) -> None:
        self.registry: dict[str, WellKnownProjectOption] = {}

    def lookup_well_known_key(self, key: str) -> WellKnownProjectOption | None:
        return self.registry.get(key)

    def freeze_option_epoch(self, project: Project, force: bool = False) -> None:
        # The options are frozen in a receiver hook for project saves.
        # See `sentry.receivers.core.freeze_option_epoch_for_project`
        if force or project.get_option("sentry:option-epoch") is None:
            from .defaults import LATEST_EPOCH

            project.update_option("sentry:option-epoch", LATEST_EPOCH)

    def set(self, project: Project | int, key: str, value: OptionValue) -> bool:
        from sentry.models.options.project_option import ProjectOption

        return ProjectOption.objects.set_value(project, key, value)

    def isset(self, project: Project | RpcProject, key: str) -> bool:
        return project.get_option(key, default=Ellipsis) is not Ellipsis

    def get(
        self,
        project: Project | RpcProject,
        key: str,
        default: OptionValue = None,
        validate: Callable[[object], bool] | None = None,
    ) -> OptionValue:
        return project.get_option(key, default=default, validate=validate)

    def delete(self, project: Project, key: str) -> None:
        from sentry.models.options.project_option import ProjectOption

        return ProjectOption.objects.unset_value(project, key)

    def register(
        self,
        key: str,
        default: OptionValue = None,
        epoch_defaults: Mapping[int, OptionValue] | None = None,
    ) -> None:
        self.registry[key] = WellKnownProjectOption(
            key=key, default=default, epoch_defaults=epoch_defaults
        )

    def all(self) -> ValuesView[WellKnownProjectOption]:
        """
        Return an iterator for all keys in the registry.
        """
        return self.registry.values()
