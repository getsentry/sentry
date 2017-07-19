"""
South-specific signals
"""

from django.dispatch import Signal
from django.conf import settings

# Sent at the start of the migration of an app
pre_migrate = Signal(providing_args=["app", "verbosity", "interactive", "db"])

# Sent after each successful migration of an app
post_migrate = Signal(providing_args=["app", "verbosity", "interactive", "db"])

# Sent after each run of a particular migration in a direction
ran_migration = Signal(providing_args=["app", "migration", "method", "verbosity", "interactive", "db"])

# Compatibility code for django.contrib.auth
# Is causing strange errors, removing for now (we might need to fix up orm first)
#if 'django.contrib.auth' in settings.INSTALLED_APPS:
    #def create_permissions_compat(app, **kwargs):
        #from django.db.models import get_app
        #from django.contrib.auth.management import create_permissions
        #create_permissions(get_app(app), (), 0)
    #post_migrate.connect(create_permissions_compat)
