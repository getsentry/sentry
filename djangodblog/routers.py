from django.conf import settings

class DBLogRouter(object):
    def db_for_write(self, model, **hints):
        if model._meta.app_label == 'dblog':
            return getattr(settings, 'DBLOG_DATABASE_USING', None)

    def db_for_read(self, model, **hints):
        return self.db_for_write(model, **hints)

    def allow_syncdb(self, db, model):
        dblog_db = getattr(settings, 'DBLOG_DATABASE_USING', None)
        if not dblog_db:
            return None
        if model._meta.app_label == 'dblog' and db != dblog_db:
            return False