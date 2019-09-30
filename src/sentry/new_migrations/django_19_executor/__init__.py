from __future__ import absolute_import

from django import VERSION
from django.db.migrations import executor, migration

from sentry.new_migrations.django_19_executor.django import Django19MigrationExecutor

# XXX: We're calling this `new_migrations` for the moment. Calling it `migrations`
# causes Django migrations to attempt to load the new style migrations. Once we've got
# everything in place and are ready to switch we'll rename this module.


# Monkeypatch Django 1.8 migration executor to use the much faster version
# from Django 1.9.1.
if VERSION[:2] < (1, 9):
    executor.MigrationExecutor = Django19MigrationExecutor
    migration.Migration.initial = None
