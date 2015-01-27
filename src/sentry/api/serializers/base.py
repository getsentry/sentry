from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser


serializers = {}


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
        t = serializers[type(objects[0])]
    except KeyError:
        return objects

    t.attach_metadata(objects, user=user)
    return [t(o, user=user) for o in objects]


def register(type):
    def wrapped(cls):
        serializers[type] = cls()
        return cls
    return wrapped


class Serializer(object):
    def __call__(self, obj, user):
        return self.serialize(obj, user)

    def attach_metadata(self, objects, user):
        pass

    def serialize(self, obj, user):
        return {}
