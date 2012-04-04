"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import django
import logging

from django.conf import settings as django_settings


class InstanceManager(object):
    def __init__(self, class_list=None, instances=True):
        if class_list is None:
            class_list = []
        self.instances = instances
        self.update(class_list)

    def add(self, class_path):
        self.cache = None
        self.class_list.append(class_path)

    def remove(self, class_path):
        self.cache = None
        self.class_list.remove(class_path)

    def update(self, class_list):
        """
        Updates the class list and wipes the cache.
        """
        self.cache = None
        self.class_list = class_list

    def all(self):
        """
        Returns a list of cached instances.
        """
        if not self.class_list:
            self.cache = []
            return []

        if self.cache is not None:
            return self.cache

        results = []
        for cls_path in self.class_list:
            module_name, class_name = cls_path.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                cls = getattr(module, class_name)
                if self.instances:
                    results.append(cls())
                else:
                    results.append(cls)
            except Exception:
                logger = logging.getLogger('sentry.errors')
                logger.exception('Unable to import %s' % (cls_path,))
                continue
        self.cache = results

        return results


def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = django_settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = django_settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]


def has_trending(alias='default'):
    return not get_db_engine('default').startswith('sqlite')


def has_charts(db):
    engine = get_db_engine(db)
    if engine.startswith('sqlite'):
        return False
    return True
