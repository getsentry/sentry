from __future__ import absolute_import

from sentry.models import AnonymousUser


registry = {}


def serialize(objects, user=None, serializer=None):
    if user is None:
        user = AnonymousUser()

    if not objects:
        return objects
    elif not isinstance(objects, (list, tuple)):
        return serialize([objects], user=user, serializer=serializer)[0]

    # elif isinstance(obj, dict):
    #     return dict((k, serialize(v, request=request)) for k, v in obj.iteritems())

    if serializer is None:
        # find the first object that is in the registry
        for o in objects:
            try:
                serializer = registry[type(o)]
                break
            except KeyError:
                pass
        else:
            return objects

    attrs = serializer.get_attrs(item_list=objects, user=user)
    return [serializer(o, attrs=attrs.get(o, {}), user=user) for o in objects]


def register(type):
    def wrapped(cls):
        registry[type] = cls()
        return cls
    return wrapped


class Serializer(object):
    def __call__(self, obj, attrs, user):
        if not obj:
            return obj
        return self.serialize(obj, attrs, user)

    def get_attrs(self, item_list, user):
        return {}

    def serialize(self, obj, attrs, user):
        return {}
