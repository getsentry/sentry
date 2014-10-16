from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser


registry = {}


def serialize(objects, user=None):
    if user is None:
        user = AnonymousUser()

    if not objects:
        return objects
    elif not isinstance(objects, (list, tuple)):
        return serialize([objects], user=user)[0]

    # elif isinstance(obj, dict):
    #     return dict((k, serialize(v, request=request)) for k, v in obj.iteritems())
    try:
        serializer = registry[type(objects[0])]
    except KeyError:
        return objects

    attrs = serializer.get_attrs(item_list=objects, user=user)
    return [serializer(o, attrs=attrs.get(o, {}), user=user) for o in objects]


def register(type):
    def wrapped(cls):
        registry[type] = cls()
        return cls
    return wrapped


class Serializer(object):
    def __call__(self, *args, **kwargs):
        return self.serialize(*args, **kwargs)

    def get_attrs(self, item_list, user):
        return {}

    def serialize(self, obj, attrs, user):
        return {}
