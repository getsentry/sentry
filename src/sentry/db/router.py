from __future__ import annotations

import logging
from collections.abc import Iterable

from django.apps import apps
from django.db import connections
from django.db.models.base import Model
from django.utils.connection import ConnectionDoesNotExist

from sentry.db.models.base import ModelSiloLimit
from sentry.silo.base import SiloLimit, SiloMode
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


class SiloConnectionUnavailableError(ValueError):
    pass


class SiloRouter:
    """
    Django database router for multi-region deployments.

    We support two configurations:

    - Monolith - all tables reside in the same database.
    - Siloed - tables for control and region are separated.

    Within Siloed there are are two flavours:

    - simulated - If the application is configured with `control` and `default`
      connections, then we are in 'simulated' silo environment (like our testsuite).
      We'll also use simulated mode for the time period after the database is split
      but before the application instances are separated.
    - isolated - If there are no control/region connections we map the `default`
      connection to be the region/control database and assume the
      'other' silo is inaccessible.
    """

    __simulated_map = {
        SiloMode.MONOLITH: "default",
        SiloMode.REGION: "default",
        SiloMode.CONTROL: "control",
    }

    __is_simulated = False
    """Whether or not we're operating in a simulated silo environment"""

    contrib_models = {
        "django_admin_log",
        "django_content_type",
        "django_site",
        "django_session",
        "auth_user",
        "auth_group",
        "auth_permission",
        "auth_group_permissions",
        "auth_user_groups",
        "auth_user_user_permissions",
    }
    """
    We use a bunch of django contrib models that don't have silo annotations.
    For now they are put in control silo.
    """

    historical_silo_assignments = {
        "sentry_actor": SiloMode.REGION,
        "sentry_teamavatar": SiloMode.REGION,
        "sentry_projectavatar": SiloMode.REGION,
        "sentry_pagerdutyservice": SiloMode.REGION,
        "sentry_notificationsetting": SiloMode.CONTROL,
        "authprovider_duplicate": SiloMode.CONTROL,
        "authidentity_duplicate": SiloMode.CONTROL,
        "sentry_alertruleactivations": SiloMode.REGION,
    }
    """
    When we remove models, we are no longer able to resolve silo assignments
    because the model classes are removed. Losing silo assignments means historical
    migrations for a model can no longer run. By preserving the historical silo assignments
    we can provide compatibility for existing migrations.
    """

    def __init__(self):
        # Memoized results of table : silo pairings
        self.__table_to_silo: dict[str, str | None] = {}
        try:
            # By accessing the connections Django will raise
            # Use `assert` to appease linters
            assert connections["control"]
            self.__is_simulated = True
            logging.debug("Using simulated silos")
        except (AssertionError, ConnectionDoesNotExist) as err:
            logging.debug("Cannot use simulated silos", extra={"error": str(err)})
            self.__is_simulated = False

    def use_simulated(self, value: bool):
        if not in_test_environment():
            raise ValueError("Cannot mutate simulation mode outside of tests")
        self.__is_simulated = value

    def _resolve_silo_connection(self, silo_modes: Iterable[SiloMode], table: str) -> str | None:
        # XXX This method has an override in getsentry for region silo primary splits.
        active_mode = SiloMode.get_current_mode()

        # In monolith mode we only use a single database.
        if active_mode == SiloMode.MONOLITH and not self.__is_simulated:
            return "default"

        for silo_mode in silo_modes:
            if self.__is_simulated:
                return self.__simulated_map[silo_mode]
            if active_mode == silo_mode:
                return "default"

        # If we're in tests raise an error, otherwise return 'no decision'
        # so that django skips migration operations that won't work.
        if in_test_environment():
            raise SiloConnectionUnavailableError(
                f"Cannot resolve table {table} in {silo_modes}. "
                f"Application silo mode is {active_mode} and simulated silos are not enabled."
            )
        else:
            return None

    def _find_model(self, table: str) -> type[Model] | None:
        # Use django's model inventory to find our table and what silo it is on.
        for model in apps.get_models(include_auto_created=True):
            if model._meta.db_table == table:
                return model
        return None

    def _silo_limit(self, model: type[Model]) -> SiloLimit | None:
        silo_limit = getattr(model._meta, "silo_limit", None)
        if silo_limit:
            return silo_limit

        db_table = model._meta.db_table
        if not silo_limit and db_table in self.contrib_models:
            return ModelSiloLimit(SiloMode.CONTROL)

        # If we didn't find a silo_limit we could be working with __fake__ model
        # from django, so we need to locate the real class by table.
        real_model = self._find_model(db_table)
        if real_model:
            return getattr(real_model._meta, "silo_limit", None)

        return None

    def _db_for_model(self, model: type[Model]) -> str | None:
        silo_limit = self._silo_limit(model)
        if not silo_limit:
            return "default"

        return self._resolve_silo_connection(silo_limit.modes, table=model._meta.db_table)

    def _db_for_table(self, table: str, app_label: str) -> str | None:
        if table in self.__table_to_silo:
            return self.__table_to_silo[table]

        model = self._find_model(table)
        if model:
            # Incrementally build up our result cache so we don't
            # have to scan through models more than once.
            self.__table_to_silo[table] = self._db_for_model(model)
        elif table in self.historical_silo_assignments:
            silo_mode = self.historical_silo_assignments[table]
            connection = self._resolve_silo_connection([silo_mode], table=table)
            self.__table_to_silo[table] = connection
        else:
            # We no longer have the model and can't determine silo assignment.
            # Default to None for sentry/getsentry app_label as models
            # in those apps must have silo assignments, and 'default'
            # for other app_labels that can't have silo assignments.
            fallback: str | None = "default"
            if app_label in {"sentry", "getsentry"}:
                fallback = None
            self.__table_to_silo[table] = fallback

        return self.__table_to_silo[table]

    def db_for_read(self, model, **hints):
        return self._db_for_model(model)

    def db_for_write(self, model, **hints):
        return self._db_for_model(model)

    def allow_relation(self, obj1, obj2, **hints):
        return self._db_for_model(obj1) == self._db_for_model(obj2)

    def allow_syncdb(self, db, model):
        return self._db_for_model(model) == db

    def allow_migrate(self, db, app_label, model=None, **hints):
        if model:
            return self._db_for_table(model._meta.db_table, app_label) == db

        # We use this hint in our RunSql/RunPython migrations to help resolve databases.
        if "tables" in hints:
            dbs = {self._db_for_table(table, app_label) for table in hints["tables"]}
            if len(dbs) > 1:
                raise RuntimeError(
                    "Migration tables resolve to multiple databases. "
                    f"Got {dbs} when only one database should be used."
                    "Please also ensure your table names in the hint are correct."
                )
            return dbs.pop() == db

        # Assume migrations with no model routing or hints need to run on
        # the default database.
        return db == "default"


class TestSiloMultiDatabaseRouter(SiloRouter):
    """Silo router used in CI"""

    secondary_db_models = {
        "sentry_monitor",
        "sentry_monitorcheckin",
        "sentry_monitorlocation",
        "sentry_monitorenvironment",
        "sentry_monitorincident",
        "sentry_monitorenvbrokendetection",
    }

    def _resolve_silo_connection(self, silo_modes: Iterable[SiloMode], table: str) -> str | None:
        connection = super()._resolve_silo_connection(silo_modes=silo_modes, table=table)
        if table in self.secondary_db_models:
            return "secondary"
        return connection
