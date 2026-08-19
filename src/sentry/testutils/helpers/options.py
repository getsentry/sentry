__all__ = ["override_options"]

from contextlib import contextmanager
from unittest.mock import patch

from django.test.utils import override_settings

from sentry.utils.types import Any


@contextmanager
def override_options(options):
    """
    A context manager for overriding specific configuration
    Options.
    """
    from django.conf import settings

    from sentry.options import default_manager
    from sentry.options.manager import OptionsManager
    from sentry.runner.initializer import options_mapper, self_hosted_options_mapper

    wrapped = default_manager.store.get
    original_lookup = OptionsManager.lookup_key

    def new_get(key, **kwargs):
        try:
            return options[key.name]
        except KeyError:
            return wrapped(key, **kwargs)

    def new_lookup(self: OptionsManager, key: str):
        # use the default key definition if available
        if key not in options or key in self.registry:
            return original_lookup(self, key)
        else:
            return self.make_key(key, lambda: "", Any, 1 << 0, 0, 0, None)

    # Patch options into SENTRY_OPTIONS as well
    new_options = settings.SENTRY_OPTIONS.copy()
    new_options.update(options)
    # Keep migrated option overrides visible to consumers that now read Django
    # settings. This preserves compatibility with older GetSentry tests while
    # their settings migration is still landing.
    settings_mapper = {**options_mapper, **self_hosted_options_mapper}
    migrated_settings = {
        setting: options[option] for option, setting in settings_mapper.items() if option in options
    }
    with override_settings(SENTRY_OPTIONS=new_options, **migrated_settings):
        with (
            patch.object(default_manager.store, "get", side_effect=new_get),
            patch("sentry.options.OptionsManager.lookup_key", new=new_lookup),
        ):
            yield
