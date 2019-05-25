from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

registry = {}


def serialize(objects, user=None, serializer=None, **kwargs):
    if user is None:
        user = AnonymousUser()

    if not objects:
        return objects
    # sets aren't predictable, so generally you should use a list, but it's
    # supported out of convenience
    elif not isinstance(objects, (list, tuple, set, frozenset)):
        return serialize([objects], user=user, serializer=serializer, **kwargs)[0]

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

    attrs = serializer.get_attrs(
        # avoid passing NoneType's to the serializer as they're allowed and
        # filtered out of serialize()
        item_list=[o for o in objects if o is not None],
        user=user,
        **kwargs
    )

    return [serializer(o, attrs=attrs.get(o, {}), user=user, **kwargs) for o in objects]


def register(type):
    def wrapped(cls):
        registry[type] = cls()
        return cls

    return wrapped


class Serializer(object):
    def __call__(self, obj, attrs, user, **kwargs):
        if obj is None:
            return
        return self.serialize(obj, attrs, user, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        return {}

    def serialize(self, obj, attrs, user, **kwargs):
        return {}
