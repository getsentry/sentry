import logging
import sys
from typing import List

from django.apps import apps
from django.db import connections
from django.db.utils import ConnectionDoesNotExist

from sentry.db.models.base import Model
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)


class SiloRouter:
    """
    Django database router for multi-region deployments.

    We support two configurations:

    - Monolith - all tables reside in the same database.
    - Siloed - tables for control and region are separated.

    Within Siloed there are are two flavours:

    - simulated - If the application is configured with `control` and `region`
      connections, then we are in 'simulated' silo environment (like our testsuite).
    - isolated - If there are no control/region connections we map the `default`
      connection to be the region/control database and assume the
      'other' silo is inaccessible.
    """

    __simulated_map = {
        SiloMode.MONOLITH: "default",
        SiloMode.REGION: "region",
        SiloMode.CONTROL: "control",
    }

    __table_to_silo = {}

    __is_simulated = False
    """Whether or not we're operating in a simulated silo environment"""

    def __init__(self):
        self.__table_to_silo = {}
        try:
            # By accessing the connections Django will raise
            # Use `assert` to appease linters
            assert connections["region"]
            assert connections["control"]
            self.__is_simulated = True
            logging.debug("Using simulated silos")
        except (AssertionError, ConnectionDoesNotExist) as err:
            logging.debug("Cannot use simulated silos", extra={"error": str(err)})
            self.__is_simulated = False

    def use_simulated(self, value: bool):
        if "pytest" not in sys.modules:
            raise ValueError("Cannot mutate simulation mode outside of tests")
        self.__is_simulated = value

    def _resolve_silo_connection(self, silo_modes: List[SiloMode], table: str):
        # XXX This method has an override in getsentry for region silo primary splits.
        active_mode = SiloMode.get_current_mode()

        # In monolith mode we only use a single database.
        if active_mode == SiloMode.MONOLITH:
            return "default"

        for silo_mode in silo_modes:
            if self.__is_simulated:
                return self.__simulated_map[silo_mode]
            if active_mode == silo_mode:
                return "default"

            raise ValueError(
                f"Cannot resolve table {table} in {silo_mode}. "
                f"Application silo mode is {active_mode} and simulated silos are not enabled."
            )

    def _db_for_model(self, model: Model):
        silo_limit = getattr(model._meta, "silo_limit", None)  # type: ignore
        if not silo_limit:
            return "default"

        return self._resolve_silo_connection(silo_limit.modes, table=model._meta.db_table)

    def _db_for_table(self, table, app_label):
        if table in self.__table_to_silo:
            return self.__table_to_silo[table]

        # Use django's model inventory to find our table and what silo it is on.
        for model in apps.get_models(app_label):
            if model._meta.db_table == table:
                # Incrementally build up our result cache so we don't
                # have to scan through models more than once.
                self.__table_to_silo[table] = self._db_for_model(model)

        # All actively used tables should be in this map, but we also
        # need to handle tables in migrations that no longer exist.
        return self.__table_to_silo.get(table, "default")

    def db_for_read(self, model, **hints):
        return self._db_for_model(model)

    def db_for_write(self, model, **hints):
        return self._db_for_model(model)

    def allow_relation(self, obj1, obj2, **hints):
        return self._db_for_model(obj1) == self._db_for_model(obj2)

    def allow_syncdb(self, db, model):
        if self._db_for_model(model) == db:
            return True
        return False

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
                )
            return dbs.pop() == db

        # Assume migrations with no model routing or hints need to run on
        # the default database.
        return db == "default"
