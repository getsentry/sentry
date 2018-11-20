from __future__ import print_function, absolute_import

import sys

import pytest
from django.db import models
from django.conf import settings
from south.migration import Migrations
from south.creator import changes, actions, freezer

APP = 'sentry'


@pytest.mark.skipif(not settings.SOUTH_TESTS_MIGRATE,
                    reason="requires activated south migrations")
def test_south_missing_migrations():
    """
    Check that the code and the migrations are in sync.
    Based on the code from "south/management/commands/schemamigration.py"
    """
    assert models.get_app(APP), "There is no enabled application matching '%s'." % APP

    # Get the Migrations for this app (creating the migrations dir if needed)
    migrations = Migrations(APP, force_creation=False, verbose_creation=True)

    # Get the latest migration
    last_migration = migrations[-1]

    # Construct two model dicts to run the differ on.
    old_defs = dict(
        (k, v) for k, v in last_migration.migration_class().models.items()
        if k.split(".")[0] == migrations.app_label()
    )
    assert old_defs

    new_defs = dict(
        (k, v) for k, v in freezer.freeze_apps([migrations.app_label()]).items()
        if k.split(".")[0] == migrations.app_label()
    )
    assert new_defs

    change_source = changes.AutoChanges(
        migrations=migrations,
        old_defs=old_defs,
        old_orm=last_migration.orm(),
        new_defs=new_defs,
    )

    # Get the actions, and then insert them into the actions lists
    forwards_actions = []
    for action_name, params in change_source.get_changes():
        # Run the correct Action class
        try:
            action_class = getattr(actions, action_name)
        except AttributeError:
            raise ValueError("Invalid action name from source: %s" % action_name)
        else:
            action = action_class(**params)
            forwards_actions.append(action)
            print(action.console_line(), file=sys.stderr)   # noqa: B314
            print(action.forwards_code(), file=sys.stderr)  # noqa: B314
            print('', file=sys.stderr)                      # noqa: B314

    assert forwards_actions == [], \
        """
        Ungenerated/unmerged migrations found.
        Run "sentry django schemamigration sentry --auto" to generate the missing migrations.
        """
