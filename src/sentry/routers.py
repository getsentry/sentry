from __future__ import absolute_import


def db_for_model(model):
    db_table = model._meta.db_table
    if db_table in {
        "sentry_file",
        "sentry_fileblobindex",
        "sentry_fileblob",
        "sentry_fileblobowner",
        "sentry_projectdsymfile",
        "sentry_projectdsymfile",
        "sentry_releasefile",
    }:
        return "file"
    return "default"


class MultiDatabaseRouter(object):
    def db_for_read(self, model, **hints):
        return db_for_model(model)

    def db_for_write(self, model, **hints):
        return db_for_model(model)

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_syncdb(self, db, model):
        if db_for_model(model) == db:
            return True
        return False
