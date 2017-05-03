from __future__ import absolute_import

from django.conf import settings


class SplitRouter(object):
    def _route_for(self, obj):
        return settings.DB_ROUTES.get(obj._meta.db_table)

    def db_for_read(self, model, **hints):
        return self._route_for(model)

    def db_for_write(self, model, **hints):
        return self._route_for(model)

    def allow_relation(self, obj1, obj2, **hints):
        route1 = self._route_for(obj1)
        route2 = self._route_for(obj2)
        if route1 != route2:
            return False
        return None

    def allow_syncdb(self, db, model):
        route = self._route_for(model)
        if route:
            return db == route
        return None
