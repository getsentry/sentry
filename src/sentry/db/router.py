import django.apps

DB_TABLE_TO_DB = {}


def db_for_model(model_class):
    if model_class._meta.app_label == "sentry":
        return list(model_class._meta._ModelSiloLimit__silo_limit.modes)[0]._name_.lower() + "_silo"
    return "default"


def db_for_table(table):
    # TODO: cache this
    # Fill DB_TABLE_TO_DB with sentry models
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label == "sentry":
            DB_TABLE_TO_DB[model_class._meta.db_table] = (
                list(model_class._meta._ModelSiloLimit__silo_limit.modes)[0]._name_.lower()
                + "_silo"
            )
    return DB_TABLE_TO_DB.get(table, "default")


class MultiDatabaseRouter:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._setup_replicas()

    def _setup_replicas(self):
        from django.conf import settings

        self._replicas = {}
        for db, db_conf in settings.DATABASES.items():
            primary = db_conf.get("REPLICA_OF")
            if primary:
                self._replicas[primary] = db

    def db_for_read(self, model, **hints):
        db = db_for_model(model)
        if hints.get("replica", False):
            db = self._replicas.get(db, db)
        return db

    def db_for_write(self, model, **hints):
        return db_for_model(model)

    def allow_relation(self, obj1, obj2, **hints):
        return db_for_model(obj1) == db_for_model(obj2)

    def allow_syncdb(self, db, model):
        if db_for_model(model) == db:
            return True
        return False

    def allow_migrate(self, db, app_label, model=None, **hints):
        if model:
            return db_for_model(model) == db

        # We use this hint in our RunSql/RunPython migrations to help resolve databases.
        if "tables" in hints:
            dbs = {db_for_table(table) for table in hints["tables"]}
            if len(dbs) > 1:
                raise RuntimeError(
                    "Migration tables resolve to multiple databases. "
                    f"Got {dbs} when only one database should be used."
                )
            return dbs.pop() == db
        # Assume migrations with no model routing or hints need to run on
        # the default database.
        return db == "default"
