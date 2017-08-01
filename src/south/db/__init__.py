
# Establish the common DatabaseOperations instance, which we call 'db'.
# Much thanks to cmkmrr for a lot of the code base here

from django.conf import settings
import sys

# A few aliases, because there's FQMNs now
engine_modules = {
    'django.db.backends.postgresql_psycopg2': 'postgresql_psycopg2',
    'django.db.backends.sqlite3': 'sqlite3',
    'django.db.backends.mysql': 'mysql',
    'mysql.connector.django': 'mysql', # MySQL Connector/Python
}

# First, work out if we're multi-db or not, and which databases we have
from django.db import DEFAULT_DB_ALIAS
# Loop over the defined databases, gathering up their engines
db_engines = dict([
    # Note we check to see if contrib.gis has overridden us.
    (alias, "south.db.%s" % engine_modules[db_settings['ENGINE']])
    for alias, db_settings in settings.DATABASES.items()
    if db_settings['ENGINE'] in engine_modules
])
# Update with any overrides
db_engines.update(getattr(settings, "SOUTH_DATABASE_ADAPTERS", {}))
# Check there's no None engines, or...
for alias, engine in db_engines.items():
    if engine is None:
        # They've used a backend we don't support
        sys.stderr.write(
            (
                "There is no South database module for your database backend '%s'. " + \
                "Please either choose a supported database, check for " + \
                "SOUTH_DATABASE_ADAPTER[S] settings, " + \
                "or remove South from INSTALLED_APPS.\n"
            ) % (settings.DATABASES[alias]['ENGINE'],)
        )
        sys.exit(1)

# Now, turn that into a dict of <alias: south db module>
dbs = {}
try:
    for alias, module_name in db_engines.items():
        module = __import__(module_name, {}, {}, [''])
        dbs[alias] = module.DatabaseOperations(alias)
except ImportError:
    # This error should only be triggered on 1.1 and below.
    sys.stderr.write(
        (
            "There is no South database module '%s' for your database. " + \
            "Please either choose a supported database, check for " + \
            "SOUTH_DATABASE_ADAPTER[S] settings, " + \
            "or remove South from INSTALLED_APPS.\n"
        ) % (module_name,)
    )
    sys.exit(1)

# Finally, to make old migrations work, keep 'db' around as the default database
db = dbs[DEFAULT_DB_ALIAS]
