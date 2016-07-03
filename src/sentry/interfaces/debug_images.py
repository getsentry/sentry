from __future__ import absolute_import

__all__ = ('DebugImages',)

from sentry.interfaces.base import Interface, InterfaceValidationError


image_types = {}


def imagetype(name):
    def decorator(f):
        image_types[name] = f
        return f
    return decorator


@imagetype('apple')
def process_apple_image(image):
    try:
        return {
            'cpu_type': image['cpu_type'],
            'cpu_subtype': image['cpu_subtype'],
            'image_addr': image['image_addr'],
            'image_size': image['image_size'],
            'image_vmaddr': image.get('image_vmaddr') or 0,
            'name': image['name'],
            'uuid': image['uuid'],
        }
    except KeyError as e:
        raise InterfaceValidationError('Missing value for apple image: %s'
                                       % e.args[0])


class DebugImages(Interface):
    """
    Holds debug image information for processing stacktraces and similar
    things.
    """

    ephemeral = True

    @classmethod
    def to_python(cls, data):
        if 'images' not in data:
            raise InterfaceValidationError('Missing key "images"')
        if 'sdk_info' not in data:
            raise InterfaceValidationError('Missing key "sdk_info"')
        return cls(
            images=[cls.normalize_image(x) for x in data['images']],
            sdk_info=data['sdk_info'],
        )

    @staticmethod
    def normalize_image(image):
        ty = image.get('type')
        if not ty:
            raise InterfaceValidationError('Image type not provided')
        func = image_types.get(ty)
        if func is None:
            raise InterfaceValidationError('Unknown image type %r' % image)
        rv = func(image)
        assert 'uuid' in rv, 'debug image normalizer did not produce a UUID'
        assert 'image_addr' in rv, 'debug image normalizer did not ' \
            'produce an object address'
        rv['type'] = ty
        return rv

    def get_path(self):
        return 'debug_images'
