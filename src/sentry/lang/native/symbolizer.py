from __future__ import absolute_import

import re
import six
import bisect

from symsynd.driver import Driver, SymbolicationError, normalize_dsym_path
from symsynd.report import ReportSymbolizer
from symsynd.macho.arch import get_cpu_name, get_macho_vmaddr
from symsynd.utils import parse_addr

from sentry.lang.native.dsymcache import dsymcache
from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import DSymSymbol, EventError
from sentry.constants import MAX_SYM, NATIVE_UNKNOWN_STRING


FATAL_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_BAD_DSYM,
)
USER_FIXABLE_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_MISSING_SYMBOL,
)
APP_BUNDLE_PATHS = (
    '/var/containers/Bundle/Application/',
    '/private/var/containers/Bundle/Application/',
)
_sim_platform_re = re.compile(r'/\w+?Simulator\.platform/')
_support_framework = re.compile(r'''(?x)
    /Frameworks/(
            libswift([a-zA-Z0-9]+)\.dylib$
        |   (KSCrash|SentrySwift|Sentry)\.framework/
    )
''')
SIM_PATH = '/Developer/CoreSimulator/Devices/'
SIM_APP_PATH = '/Containers/Bundle/Application/'

KNOWN_GARBAGE_SYMBOLS = set([
    '_mh_execute_header',
    '<redacted>',
    NATIVE_UNKNOWN_STRING,
])


@implements_to_string
class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, image=None):
        Exception.__init__(self)
        self.message = six.text_type(message)
        self.type = type
        if image is not None:
            self.image_uuid = image['uuid'].lower()
            self.image_path = image['name']
            self.image_name = image['name'].rsplit('/', 1)[-1]
            self.image_arch = get_cpu_name(image['cpu_type'],
                                           image['cpu_subtype'])
        else:
            self.image_uuid = None
            self.image_name = None
            self.image_path = None
            self.image_arch = None

    @property
    def is_user_fixable(self):
        """These are errors that a user can fix themselves."""
        return self.type in USER_FIXABLE_ERRORS

    @property
    def is_fatal(self):
        """If this is true then a processing issues has to be reported."""
        return self.type in FATAL_ERRORS

    @property
    def is_sdk_failure(self):
        """An error that most likely happened because of a bad SDK."""
        return self.type == EventError.NATIVE_UNKNOWN_IMAGE

    def __str__(self):
        rv = []
        if self.type is not None:
            rv.append(u'%s: ' % self.type)
        rv.append(self.message or 'no information available')
        if self.image_uuid is not None:
            rv.append(' image-uuid=%s' % self.image_uuid)
        if self.image_name is not None:
            rv.append(' image-name=%s' % self.image_name)
        return u''.join(rv)


def trim_frame(frame):
    # This matches what's in stacktrace.py
    frame['symbol_name'] = trim(frame.get('symbol_name'), MAX_SYM)
    frame['filename'] = trim(frame.get('filename'), 256)
    return frame


def find_system_symbol(img, instruction_addr, sdk_info=None, cpu_name=None):
    """Finds a system symbol."""
    img_cpu_name = get_cpu_name(img['cpu_type'], img['cpu_subtype'])
    cpu_name = img_cpu_name or cpu_name
    return DSymSymbol.objects.lookup_symbol(
        instruction_addr=instruction_addr,
        image_addr=img['image_addr'],
        image_vmaddr=img['image_vmaddr'],
        uuid=img['uuid'],
        cpu_name=cpu_name,
        object_path=img['name'],
        sdk_info=sdk_info
    )


def make_symbolizer(project, image_lookup, referenced_images=None,
        on_dsym_file_referenced=None):
    """Creates a symbolizer for the given project and binary images.  If a
    list of referenced images is referenced (UUIDs) then only images
    needed by those frames are loaded.
    """
    driver = Driver()

    to_load = referenced_images
    if to_load is None:
        to_load = image_lookup.get_uuids()

    dsym_paths, loaded = dsymcache.fetch_dsyms(project, to_load,
        on_dsym_file_referenced=on_dsym_file_referenced)

    # We only want to pass the actually loaded symbols to the report
    # symbolizer to avoid the expensive FS operations that will otherwise
    # happen.
    user_images = []
    for img in image_lookup.iter_images():
        if img['uuid'] in loaded:
            user_images.append(img)

    return ReportSymbolizer(driver, dsym_paths, user_images)


class ImageLookup(object):

    def __init__(self, images):
        self._image_addresses = []
        self.images = {}
        for img in images:
            img_addr = parse_addr(img['image_addr'])
            self._image_addresses.append(img_addr)
            self.images[img_addr] = img
        self._image_addresses.sort()

    def iter_images(self):
        return six.itervalues(self.images)

    def get_uuids(self):
        return list(self.iter_uuids())

    def iter_uuids(self):
        for img in self.iter_images():
            yield img['uuid']

    def find_image(self, addr):
        """Given an instruction address this locates the image this address
        is contained in.
        """
        idx = bisect.bisect_left(self._image_addresses, parse_addr(addr))
        if idx > 0:
            return self.images[self._image_addresses[idx - 1]]


class Symbolizer(object):
    """This symbolizer dispatches to both symsynd and the system symbols
    we have in the database and reports errors slightly differently.
    """

    def __init__(self, project, binary_images, referenced_images=None,
                 cpu_name=None, on_dsym_file_referenced=None):
        if isinstance(binary_images, ImageLookup):
            self.image_lookup = binary_images
        else:
            self.image_lookup = ImageLookup(binary_images)
        self.symsynd_symbolizer = make_symbolizer(
            project, self.image_lookup,
            referenced_images=referenced_images,
            on_dsym_file_referenced=on_dsym_file_referenced)
        self.cpu_name = cpu_name

    def resolve_missing_vmaddrs(self):
        """When called this changes the vmaddr on all contained images from
        the information in the dsym files (if there is no vmaddr already).
        This changes both the image data from the original event submission
        in the debug meta as well as the image data that the symbolizer uses.
        """
        changed_any = False

        loaded_images = self.symsynd_symbolizer.images
        for image_addr, image in six.iteritems(self.image_lookup.images):
            if image.get('image_vmaddr') or not image.get('image_addr'):
                continue
            image_info = loaded_images.get(image_addr)
            if not image_info:
                continue
            dsym_path = normalize_dsym_path(image_info['dsym_path'])
            # Here we use the CPU name from the image as it might be
            # slightly different (armv7 vs armv7f for instance)
            cpu_name = image_info['cpu_name']
            image_vmaddr = get_macho_vmaddr(dsym_path, cpu_name)
            if image_vmaddr:
                image['image_vmaddr'] = image_vmaddr
                image_info['image_vmaddr'] = image_vmaddr
                changed_any = True

        return changed_any

    def close(self):
        self.symsynd_symbolizer.driver.close()

    def _process_frame(self, frame, img):
        rv = trim_frame(frame)
        if img is not None:
            # Only set the object name if we "upgrade" it from a filename to
            # full path.
            if rv.get('object_name') is None or \
               ('/' not in rv['object_name'] and '/' in img['name']):
                rv['object_name'] = img['name']
            rv['uuid'] = img['uuid']

        return rv

    def _get_frame_package(self, frame, img):
        obj_name = frame.get('object_name')
        if obj_name and '/' in obj_name:
            return obj_name
        return img['name']

    def is_frame_from_app_bundle(self, frame, img):
        fn = self._get_frame_package(frame, img)
        if not (fn.startswith(APP_BUNDLE_PATHS) or
                (SIM_PATH in fn and SIM_APP_PATH in fn)):
            return False
        return True

    def _is_support_framework(self, frame, img):
        """True if the frame is from a framework that is known and app
        bundled.  Those are frameworks which are specifically not frameworks
        that are ever in_app.
        """
        fn = self._get_frame_package(frame, img)
        return _support_framework.search(fn) is not None

    def _is_app_bundled_framework(self, frame, img):
        fn = self._get_frame_package(frame, img)
        return fn.startswith(APP_BUNDLE_PATHS) and '/Frameworks/' in fn

    def _is_app_frame(self, frame, img):
        """Given a frame derives the value of `in_app` by discarding the
        original value of the frame.
        """
        if not self.is_frame_from_app_bundle(frame, img):
            return False
        return not self._is_app_bundled_framework(frame, img)

    def _is_optional_dsym(self, frame, img):
        """Checks if this is a dsym that is optional."""
        # Frames that are not in the app are not considered optional.  In
        # theory we should never reach this anyways.
        if not self.is_frame_from_app_bundle(frame, img):
            return False

        # If we're dealing with an app bundled framework that is also
        # considered optional.
        if self._is_app_bundled_framework(frame, img):
            return True

        # Frameworks that are known to sentry and bundled helpers are always
        # optional for now.  In theory this should always be False here
        # because we should catch it with the last branch already.
        if self._is_support_framework(frame, img):
            return True

        return False

    def _is_simulator_frame(self, frame, img):
        fn = self._get_frame_package(frame, img)
        return _sim_platform_re.search(fn) is not None

    def is_in_app(self, frame):
        img = self.image_lookup.find_image(frame['instruction_addr'])
        return img is not None and self._is_app_frame(frame, img)

    def symbolize_app_frame(self, frame, img, symbolize_inlined=False):
        # If we have an image but we can't find the image in the symsynd
        # symbolizer it means we are dealing with a missing dsym here.
        if parse_addr(img['image_addr']) not in self.symsynd_symbolizer.images:
            if self._is_optional_dsym(frame, img):
                type = EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM
            else:
                type = EventError.NATIVE_MISSING_DSYM
            raise SymbolicationFailed(
                type=type,
                image=img
            )

        try:
            rv = self.symsynd_symbolizer.symbolize_frame(
                frame, silent=False, demangle=False,
                symbolize_inlined=symbolize_inlined)
        except SymbolicationError as e:
            raise SymbolicationFailed(
                type=EventError.NATIVE_BAD_DSYM,
                message=six.text_type(e),
                image=img
            )

        if not rv:
            raise SymbolicationFailed(
                type=EventError.NATIVE_MISSING_SYMBOL,
                image=img
            )

        if symbolize_inlined:
            return [self._process_frame(nf, img) for nf in reversed(rv)]
        return self._process_frame(rv, img)

    def symbolize_system_frame(self, frame, img, sdk_info,
                               symbolize_inlined=False,
                               symbolserver_match=None):
        """Symbolizes a frame with system symbols only."""
        if symbolserver_match is not None:
            rv = self._process_frame(dict(frame,
                symbol_name=symbolserver_match['symbol'], filename=None,
                line=0, column=0,
                object_name=symbolserver_match['object_name']), img)
        else:
            symbol = find_system_symbol(
                img, frame['instruction_addr'], sdk_info, self.cpu_name)
            if symbol is None:
                # Simulator frames cannot be symbolicated
                if self._is_simulator_frame(frame, img):
                    type = EventError.NATIVE_SIMULATOR_FRAME
                else:
                    type = EventError.NATIVE_MISSING_SYSTEM_DSYM
                raise SymbolicationFailed(
                    type=type,
                    image=img
                )
            rv = self._process_frame(dict(frame,
                symbol_name=symbol, filename=None, line=0, column=0,
                object_name=img['name']), img)

        # We actually do not support inline symbolication for system
        # frames, so we just only ever return a single frame here.  Maybe
        # we can improve this in the future.
        if symbolize_inlined:
            return [rv]
        return rv

    def symbolize_symbolserver_match(self, frame, img, match,
                                     symbolize_inlined=False):
        rv = self._process_frame(dict(frame,
            symbol_name=match['symbol'], filename=None, line=0, column=0,
            object_name=match['object_name']), img)
        if symbolize_inlined:
            return [rv]
        return rv

    def symbolize_frame(self, frame, sdk_info=None, symbolserver_match=None,
                        symbolize_inlined=False):
        # If we do not have a CPU name we fail.  We currently only support
        # a single cpu architecture.
        if self.cpu_name is None:
            raise SymbolicationFailed(
                type=EventError.NATIVE_INTERNAL_FAILURE,
                message='Found multiple architectures.'
            )

        img = self.image_lookup.find_image(frame['instruction_addr'])
        if img is None:
            raise SymbolicationFailed(
                type=EventError.NATIVE_UNKNOWN_IMAGE
            )

        # If we are dealing with a frame that is not bundled with the app
        # we look at system symbols.  If that fails, we go to looking for
        # app symbols explicitly.
        if not self.is_frame_from_app_bundle(frame, img):
            return self.symbolize_system_frame(frame, img, sdk_info,
                                               symbolize_inlined,
                                               symbolserver_match)

        return self.symbolize_app_frame(frame, img, symbolize_inlined)

    def symbolize_backtrace(self, backtrace, sdk_info=None):
        # TODO: kill me.  This makes bad results
        rv = []
        errors = []
        idx = -1

        for idx, frm in enumerate(backtrace):
            try:
                rv.append(self.symbolize_frame(frm, sdk_info))
            except SymbolicationFailed as e:
                rv.append(frm)
                errors.append({
                    'type': EventError.NATIVE_INTERNAL_FAILURE,
                    'frame': frm,
                    'error': u'frame #%d: %s' % (idx, e),
                })
        return rv, errors
