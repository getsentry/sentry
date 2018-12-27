from __future__ import absolute_import

import six
import uuid

__all__ = ('DebugMeta', )

from sentry.interfaces.base import Interface, InterfaceValidationError

from symbolic import parse_addr, normalize_debug_id

image_types = {}


def imagetype(name):
    def decorator(f):
        image_types[name] = f
        return f

    return decorator


def _addr(x):
    return '0x%x' % parse_addr(x)


@imagetype('symbolic')
def process_symbolic_image(image):
    try:
        symbolic_image = {
            'id': normalize_debug_id(image.get('id')),
            'image_addr': _addr(image.get('image_addr')),
            'image_size': parse_addr(image['image_size']),
            'image_vmaddr': _addr(image.get('image_vmaddr') or 0),
            'name': image.get('name'),
        }

        if image.get('arch') is not None:
            symbolic_image['arch'] = image.get('arch')

        return symbolic_image
    except KeyError as e:
        raise InterfaceValidationError('Missing value for symbolic image: %s' % e.args[0])


@imagetype('apple')
def process_apple_image(image):
    try:
        apple_image = {
            'uuid': six.text_type(uuid.UUID(image['uuid'])),
            'cpu_type': image.get('cpu_type'),
            'cpu_subtype': image.get('cpu_subtype'),
            'image_addr': _addr(image.get('image_addr')),
            'image_size': image['image_size'],
            'image_vmaddr': _addr(image.get('image_vmaddr') or 0),
            'name': image.get('name'),
        }

        if image.get('arch') is not None:
            apple_image['arch'] = image.get('arch')
        if image.get('major_version') is not None:
            apple_image['major_version'] = image['major_version']
        if image.get('minor_version') is not None:
            apple_image['minor_version'] = image['minor_version']
        if image.get('revision_version') is not None:
            apple_image['revision_version'] = image['revision_version']

        return apple_image
    except KeyError as e:
        raise InterfaceValidationError('Missing value for apple image: %s' % e.args[0])


@imagetype('proguard')
def process_proguard_image(image):
    try:
        return {
            'uuid': six.text_type(uuid.UUID(image['uuid'])),
        }
    except KeyError as e:
        raise InterfaceValidationError('Missing value for proguard image: %s' % e.args[0])


class DebugMeta(Interface):
    """
    Holds debug meta information information for processing stacktraces
    and similar things.  This information is deleted after event processing.

    Currently two attributes exist:

    ``sdk_info``:
        sets the SDK that is used for the system.  This affects the lookup
        for system symbols.  If not defined, system symbols are not looked up.
    ``images``:
        a list of debug images and their mappings.
    """

    ephemeral = False

    @classmethod
    def to_python(cls, data):
        images = data.get('images', [])
        is_debug_build = data.get('is_debug_build')
        if is_debug_build is not None and not isinstance(is_debug_build, bool):
            raise InterfaceValidationError('Invalid value for "is_debug_build"')

        return cls(
            images=[cls.normalize_image(x) for x in images],
            sdk_info=cls.normalize_sdk_info(data.get('sdk_info')),
            is_debug_build=is_debug_build,
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
        assert 'uuid' in rv or 'id' in rv, 'debug image normalizer did not produce an identifier'
        rv['type'] = ty
        return rv

    @staticmethod
    def normalize_sdk_info(sdk_info):
        if not sdk_info:
            return None
        try:
            return {
                'dsym_type': sdk_info.get('dsym_type') or 'none',
                'sdk_name': sdk_info['sdk_name'],
                'version_major': sdk_info['version_major'],
                'version_minor': sdk_info['version_minor'],
                'version_patchlevel': sdk_info.get('version_patchlevel') or 0,
                'build': sdk_info.get('build'),
            }
        except KeyError as e:
            raise InterfaceValidationError('Missing value for sdk_info: %s' % e.args[0])

    def get_path(self):
        return 'debug_meta'
