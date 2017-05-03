from __future__ import absolute_import

import re
import six

from symsynd.driver import Driver, SymbolicationError
from symsynd.macho.arch import get_cpu_name
from symsynd.images import ImageLookup

from sentry.lang.native.dsymcache import dsymcache
from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import EventError
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

        self.driver = Driver()

        to_load = referenced_images
        if to_load is None:
            to_load = self.image_lookup.get_uuids()

        self.dsym_paths = dsymcache.fetch_dsyms(
            project, to_load, on_dsym_file_referenced=on_dsym_file_referenced)

        self.cpu_name = cpu_name

    def close(self):
        self.driver.close()

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

    def symbolize_app_frame(self, frame, img):
        dsym_path = self.dsym_paths.get(img['uuid'])
        if dsym_path is None:
            if self._is_optional_dsym(frame, img):
                type = EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM
            else:
                type = EventError.NATIVE_MISSING_DSYM
            raise SymbolicationError(type=type, image=img)

        try:
            rv = self.driver.symbolize(
                dsym_path, img['image_vmaddr'], img['image_addr'],
                img['instruction_addr'], self.cpu_name, symbolize_inlined=True)
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
        return [self._process_frame(nf, img) for nf in reversed(rv)]

    def symbolize_system_frame(self, frame, img, sdk_info,
                               symbolserver_match=None):
        """Symbolizes a frame with system symbols only."""
        if symbolserver_match is not None:
            rv = self._process_frame(dict(frame,
                symbol_name=symbolserver_match['symbol'], filename=None,
                line=0, column=0,
                object_name=symbolserver_match['object_name']), img)

        return [rv]

    def symbolize_symbolserver_match(self, frame, img, match):
        return [self._process_frame(dict(frame,
            symbol_name=match['symbol'], filename=None, line=0, column=0,
            object_name=match['object_name']), img)]

    def symbolize_frame(self, frame, sdk_info=None, symbolserver_match=None):
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
                                               symbolserver_match)

        return self.symbolize_app_frame(frame, img)
