__all__ = ["override_options"]

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import patch

from django.test.utils import override_settings

from sentry.utils.types import Any

if TYPE_CHECKING:
    from sentry.options.store import Key


@contextmanager
def override_options(options: Mapping[str, object]) -> Iterator[None]:
    """
    A context manager for overriding specific configuration
    Options.
    """
    from django.conf import settings

    from sentry.options import default_manager
    from sentry.options.manager import OptionsManager

    wrapped = default_manager.store.get
    original_lookup = OptionsManager.lookup_key

    def new_get(key: Key, silent: bool = False) -> object | None:
        try:
            return options[key.name]
        except KeyError:
            return wrapped(key, silent=silent)

    def new_lookup(self: OptionsManager, key: str) -> Key:
        # use the default key definition if available
        if key not in options or key in self.registry:
            return original_lookup(self, key)
        else:
            return self.make_key(key, lambda: "", Any, 1 << 0, 0, 0, None)

    # Patch options into SENTRY_OPTIONS as well
    new_options = settings.SENTRY_OPTIONS.copy()
    new_options.update(options)
    with override_settings(SENTRY_OPTIONS=new_options):
        with (
            patch.object(default_manager.store, "get", side_effect=new_get),
            patch("sentry.options.OptionsManager.lookup_key", new=new_lookup),
        ):
            yield
