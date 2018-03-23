"""
Hacks for the Django 1.0/1.0.2 releases.
"""

import django
import six


from collections import defaultdict, OrderedDict
from django.conf import settings
try:
    from django.db.backends.creation import BaseDatabaseCreation
except ImportError:
    from django.db.backends.base.creation import BaseDatabaseCreation
from django.db.models.loading import cache
from django.core import management
from django.core.management.commands.flush import Command as FlushCommand
from django.utils.datastructures import SortedDict

from south.constants import DJANGO_17

if DJANGO_17:
    from django.apps.registry import apps
else:
    apps = None


class SkipFlushCommand(FlushCommand):
    def handle_noargs(self, **options):
        # no-op to avoid calling flush
        return


class Hacks:
    def set_installed_apps(self, apps):
        """
        Sets Django's INSTALLED_APPS setting to be effectively the list passed in.
        """

        # Make sure it's a list.
        apps = list(apps)

        # Make sure it contains strings
        if apps:
            assert isinstance(
                apps[0], string_types), "The argument to set_installed_apps must be a list of strings."

        # Monkeypatch in!
        settings.INSTALLED_APPS, settings.OLD_INSTALLED_APPS = (
            apps,
            settings.INSTALLED_APPS,
        )
        self._redo_app_cache()

    def reset_installed_apps(self):
        """
        Undoes the effect of set_installed_apps.
        """
        settings.INSTALLED_APPS = settings.OLD_INSTALLED_APPS
        self._redo_app_cache()

    def _redo_app_cache(self):
        """
        Used to repopulate AppCache after fiddling with INSTALLED_APPS.
        """
        cache.loaded = False
        cache.handled = set() if django.VERSION >= (1, 6) else {}
        cache.postponed = []
        cache.app_store = SortedDict()
        cache.app_models = SortedDict()
        cache.app_errors = {}
        cache._populate()

    def clear_app_cache(self):
        """
        Clears the contents of AppCache to a blank state, so new models
        from the ORM can be added.
        """
        # Django 1.7+ throws a runtime error in some situations due to model validation:
        # >>> RuntimeError: Conflicting 'user' models in application 'sentry': <class 'sentry.models.user.User'> and <class 'sentry.models.User'>.
        if DJANGO_17:
            self.old_app_models, apps.all_models = apps.all_models, defaultdict(OrderedDict)
            apps.clear_cache()
        else:
            self.old_app_models, cache.app_models = cache.app_models, {}

    def unclear_app_cache(self):
        """
        Reversed the effects of clear_app_cache.
        """
        if DJANGO_17:
            apps.all_models = self.old_app_models
            apps.clear_cache()
        else:
            cache.app_models = self.old_app_models
            cache._get_models_cache = {}

    def repopulate_app_cache(self):
        """
        Rebuilds AppCache with the real model definitions.
        """
        if DJANGO_17:
            apps.clear_cache()
        else:
            cache._populate()

    def store_app_cache_state(self):
        self.stored_app_cache_state = dict(**cache.__dict__)

    def restore_app_cache_state(self):
        cache.__dict__ = self.stored_app_cache_state

    def patch_flush_during_test_db_creation(self):
        """
        Patches BaseDatabaseCreation.create_test_db to not flush database
        """

        def patch(f):
            def wrapper(*args, **kwargs):
                # hold onto the original and replace flush command with a no-op
                original_flush_command = management._commands['flush']
                try:
                    management._commands['flush'] = SkipFlushCommand()
                    # run create_test_db
                    return f(*args, **kwargs)
                finally:
                    # unpatch flush back to the original
                    management._commands['flush'] = original_flush_command
            return wrapper

        BaseDatabaseCreation.create_test_db = patch(BaseDatabaseCreation.create_test_db)
