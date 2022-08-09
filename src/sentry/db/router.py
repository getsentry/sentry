_db_table_to_db = {
    "sentry_stringindexer": "metrics-spanner",  # will replace ^ table above
    "sentry_perfstringindexer": "metrics-spanner",  # will replace ^ table above
}


def db_for_model(model):
    return db_for_table(model._meta.db_table)


def db_for_table(table):
    return _db_table_to_db.get(table, "default")


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
