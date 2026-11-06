from __future__ import annotations

__all__ = ["override_options"]

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING
from unittest.mock import patch

from django.conf import UserSettingsHolder, settings
from django.test.utils import override_settings

from sentry.utils.types import Any

_option_overrides: ContextVar[Mapping[str, object] | None] = ContextVar(
    "option_overrides", default=None
)

if TYPE_CHECKING:
    from sentry.options.store import Key


@dataclass(frozen=True)
class _OverriddenOptions(Mapping[str, object]):
    overrides: Mapping[str, object]
    defaults: Mapping[str, object]

    def __getitem__(self, key: str) -> object:
        try:
            return self.overrides[key]
        except KeyError:
            return self.defaults[key]

    def __iter__(self) -> Iterator[str]:
        yield from self.overrides
        yield from (key for key in self.defaults if key not in self.overrides)

    def __len__(self) -> int:
        return len(self.overrides.keys() | self.defaults.keys())


@contextmanager
def override_options(options: Mapping[str, object]) -> Iterator[None]:
    """
    A context manager for overriding specific configuration
    Options.
    """
    from sentry.options import default_manager, manager
    from sentry.options.manager import OptionsManager

    wrapped = default_manager.store.get
    original_lookup = OptionsManager.lookup_key

    def new_get(key: Key, silent: bool = False) -> object | None:
        try:
            return options[key.name]
        except KeyError:
            return wrapped(key, silent=silent)

    def new_lookup(self: OptionsManager, key: str) -> Key:
        if key not in options or key in self.registry:
            return original_lookup(self, key)
        else:
            return self.make_key(key, lambda: "", Any, 1 << 0, 0, 0, None)

    defaults = _option_overrides.get()
    new_options = _OverriddenOptions(
        options, settings.SENTRY_OPTIONS if defaults is None else defaults
    )
    token = _option_overrides.set(new_options)
    option_settings = UserSettingsHolder(settings)
    option_settings.SENTRY_OPTIONS = new_options
    try:
        with (
            override_settings(SENTRY_OPTIONS=new_options),
            patch.object(manager, "settings", option_settings),
            patch.object(default_manager.store, "get", side_effect=new_get),
            patch("sentry.options.OptionsManager.lookup_key", new=new_lookup),
        ):
            yield
    finally:
        _option_overrides.reset(token)
