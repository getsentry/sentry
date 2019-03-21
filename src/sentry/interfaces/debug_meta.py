from __future__ import absolute_import

import six
import uuid

__all__ = ('DebugMeta', )

from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys, RUST_RENORMALIZED_DEFAULT

from symbolic import parse_addr, normalize_debug_id

image_types = {}


def imagetype(name):
    def decorator(f):
        image_types[name] = f
        return f

    return decorator


def _addr(x):
    if x is None:
        return None
    return '0x%x' % parse_addr(x)


@imagetype('apple')
@imagetype('macho')
@imagetype('elf')
@imagetype('pe')
@imagetype('symbolic')
def process_native_image(image):
    # NOTE that this is dead code as soon as Rust renormalization is fully
    # enabled. After that, this code should be deleted. There is a difference
    # TODO(untitaker): Remove with other normalization code.
    try:
        native_image = {
            'code_file': image.get('code_file') or image.get('name'),
            'debug_id': normalize_debug_id(
                image.get('debug_id') or image.get('id') or image.get('uuid')),
            'image_addr': _addr(image.get('image_addr')),
            'image_size': _addr(image.get('image_size')),
            'image_vmaddr': _addr(image.get('image_vmaddr')),
        }

        if image.get('arch') is not None:
            native_image['arch'] = image.get('arch')
        if image.get('code_id') is not None:
            native_image['code_id'] = image.get('code_id')
        if image.get('debug_file') is not None:
            native_image['debug_file'] = image.get('debug_file')

        return native_image
    except KeyError as e:
        raise InterfaceValidationError('Missing value for symbolic image: %s' % e.args[0])


@imagetype('proguard')
def process_proguard_image(image):
    try:
        if image['uuid'] is None:
            raise KeyError('uuid')

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
    path = 'debug_meta'
    external_type = 'debugmeta'

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        is_debug_build = data.get('is_debug_build', None)

        if rust_renormalized:
            images = data.get('images', None) or []
        else:
            if is_debug_build is not None and not isinstance(is_debug_build, bool):
                raise InterfaceValidationError('Invalid value for "is_debug_build"')

            images = []
            for x in data.get('images', None) or ():
                if x is None:
                    continue
                images.append(cls.normalize_image(x))

        return cls(
            images=images,
            sdk_info=cls.normalize_sdk_info(data.get('sdk_info')),
            is_debug_build=is_debug_build,
        )

    def to_json(self):
        return prune_empty_keys({
            'images': self.images or None,
            'sdk_info': self.sdk_info or None,
            'is_debug_build': self.is_debug_build
        })

    @staticmethod
    def normalize_image(image):
        ty = image.get('type')
        if not ty:
            raise InterfaceValidationError('Image type not provided')
        if ty == 'apple':
            # Legacy alias. The schema is actually slightly different, but
            # process_native_image can deal with this and convert to a valid
            # MachO image payload.
            ty = 'macho'
        func = image_types.get(ty)
        if func is None:
            raise InterfaceValidationError('Unknown image type %r' % image)
        rv = func(image)
        assert 'uuid' in rv or 'debug_id' in rv, 'debug image normalizer did not produce an identifier'
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
