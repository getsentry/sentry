from __future__ import absolute_import

import re
import six

from symsynd import demangle_symbol, SymbolicationError, get_cpu_name, \
    ImageLookup, Symbolizer as SymsyndSymbolizer

from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import EventError, ProjectDSymFile
from sentry.constants import MAX_SYM, NATIVE_UNKNOWN_STRING

FATAL_ERRORS = (EventError.NATIVE_MISSING_DSYM, EventError.NATIVE_BAD_DSYM, )
USER_FIXABLE_ERRORS = (
    EventError.NATIVE_MISSING_DSYM, EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
    EventError.NATIVE_BAD_DSYM, EventError.NATIVE_MISSING_SYMBOL,
)
APP_BUNDLE_PATHS = (
    '/var/containers/Bundle/Application/', '/private/var/containers/Bundle/Application/',
)
_sim_platform_re = re.compile(r'/\w+?Simulator\.platform/')
_support_framework = re.compile(
    r'''(?x)
    /Frameworks/(
            libswift([a-zA-Z0-9]+)\.dylib$
        |   (KSCrash|SentrySwift|Sentry)\.framework/
    )
'''
)
SIM_PATH = '/Developer/CoreSimulator/Devices/'
SIM_APP_PATH = '/Containers/Bundle/Application/'
MAC_OS_PATH = '.app/Contents/'

_internal_function_re = re.compile(r'(kscm_|kscrash_|KSCrash |SentryClient |RNSentry )')

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
            self.image_arch = get_cpu_name(image['cpu_type'], image['cpu_subtype'])
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


class Symbolizer(object):
    """This symbolizer dispatches to both symsynd and the system symbols
    we have in the database and reports errors slightly differently.
    """

    def __init__(
        self,
        project,
        binary_images,
        referenced_images=None,
        cpu_name=None,
        on_dsym_file_referenced=None
    ):
        if isinstance(binary_images, ImageLookup):
            self.image_lookup = binary_images
        else:
            self.image_lookup = ImageLookup(binary_images)

        self._symbolizer = SymsyndSymbolizer()

        to_load = referenced_images
        if to_load is None:
            to_load = self.image_lookup.get_uuids()

        self.dsym_paths = ProjectDSymFile.dsymcache.fetch_dsyms(
            project, to_load, on_dsym_file_referenced=on_dsym_file_referenced
        )

        self.cpu_name = cpu_name

    def close(self):
        self._symbolizer.close()

    def _process_frame(self, frame, img):
        symbol = trim(frame['symbol'], MAX_SYM)
        function = trim(demangle_symbol(frame['symbol'], simplified=True), MAX_SYM)

        frame['function'] = function
        if function != symbol:
            frame['symbol'] = symbol
        else:
            frame['symbol'] = None

        frame['filename'] = trim(frame.get('filename'), 256)
        frame['abs_path'] = trim(frame.get('abs_path'), 256)

        return frame

    def is_image_from_app_bundle(self, img, sdk_info=None):
        fn = img['name']
        is_mac_platform = (sdk_info is not None and sdk_info['sdk_name'].lower() == 'macos')
        if not (
            fn.startswith(APP_BUNDLE_PATHS) or (SIM_PATH in fn and SIM_APP_PATH in fn) or
            (is_mac_platform and MAC_OS_PATH in fn)
        ):
            return False
        return True

    def _is_support_framework(self, img):
        """True if the frame is from a framework that is known and app
        bundled.  Those are frameworks which are specifically not frameworks
        that are ever in_app.
        """
        return _support_framework.search(img['name']) is not None

    def _is_app_bundled_framework(self, img):
        fn = img['name']
        return fn.startswith(APP_BUNDLE_PATHS) and '/Frameworks/' in fn

    def _is_app_frame(self, instruction_addr, img, sdk_info=None):
        """Given a frame derives the value of `in_app` by discarding the
        original value of the frame.
        """
        # Anything that is outside the app bundle is definitely not a
        # frame from out app.
        if not self.is_image_from_app_bundle(img, sdk_info=sdk_info):
            return False

        # We also do not consider known support frameworks to be part of
        # the app
        if self._is_support_framework(img):
            return False

        # Otherwise, yeah, let's just say it's in_app
        return True

    def _is_optional_dsym(self, img, sdk_info=None):
        """Checks if this is a dsym that is optional."""
        # Frames that are not in the app are not considered optional.  In
        # theory we should never reach this anyways.
        if not self.is_image_from_app_bundle(img, sdk_info=sdk_info):
            return False

        # If we're dealing with an app bundled framework that is also
        # considered optional.
        if self._is_app_bundled_framework(img):
            return True

        # Frameworks that are known to sentry and bundled helpers are always
        # optional for now.  In theory this should always be False here
        # because we should catch it with the last branch already.
        if self._is_support_framework(img):
            return True

        return False

    def _is_simulator_frame(self, frame, img):
        return _sim_platform_re.search(img['name']) is not None

    def _symbolize_app_frame(self, instruction_addr, img, sdk_info=None):
        dsym_path = self.dsym_paths.get(img['uuid'])
        if dsym_path is None:
            if self._is_optional_dsym(img, sdk_info=sdk_info):
                type = EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM
            else:
                type = EventError.NATIVE_MISSING_DSYM
            raise SymbolicationFailed(type=type, image=img)

        # cputype of image might be a variation of self.cpu_name
        # e.g.: armv7 instead of armv7f
        # (example error fat file does not contain armv7f)
        cpu_name = get_cpu_name(img['cpu_type'], img['cpu_subtype'])

        try:
            rv = self._symbolizer.symbolize(
                dsym_path,
                img['image_vmaddr'],
                img['image_addr'],
                instruction_addr,
                cpu_name,
                symbolize_inlined=True
            )
        except SymbolicationError as e:
            raise SymbolicationFailed(
                type=EventError.NATIVE_BAD_DSYM, message=six.text_type(e), image=img
            )

        if not rv:
            raise SymbolicationFailed(type=EventError.NATIVE_MISSING_SYMBOL, image=img)
        return [self._process_frame(nf, img) for nf in reversed(rv)]

    def _convert_symbolserver_match(self, instruction_addr, symbolserver_match, img):
        """Symbolizes a frame with system symbols only."""
        if symbolserver_match is None:
            return []

        symbol = symbolserver_match['symbol']
        if symbol[:1] == '_':
            symbol = symbol[1:]

        return [
            self._process_frame(
                dict(
                    symbol=symbol,
                    filename=None,
                    abs_path=None,
                    lineno=0,
                    colno=0,
                    package=symbolserver_match['object_name']
                ), img
            )
        ]

    def symbolize_frame(self, instruction_addr, sdk_info=None, symbolserver_match=None):
        # If we do not have a CPU name we fail.  We currently only support
        # a single cpu architecture.
        if self.cpu_name is None:
            raise SymbolicationFailed(
                type=EventError.NATIVE_INTERNAL_FAILURE, message='Found multiple architectures.'
            )

        img = self.image_lookup.find_image(instruction_addr)
        if img is None:
            raise SymbolicationFailed(type=EventError.NATIVE_UNKNOWN_IMAGE)

        # If we are dealing with a frame that is not bundled with the app
        # we look at system symbols.  If that fails, we go to looking for
        # app symbols explicitly.
        if not self.is_image_from_app_bundle(img, sdk_info=sdk_info):
            return self._convert_symbolserver_match(instruction_addr, symbolserver_match, img)

        return self._symbolize_app_frame(instruction_addr, img, sdk_info=sdk_info)

    def is_in_app(self, instruction_addr, sdk_info=None):
        img = self.image_lookup.find_image(instruction_addr)
        return img is not None and self._is_app_frame(instruction_addr, img, sdk_info=sdk_info)

    def is_internal_function(self, function):
        return _internal_function_re.search(function) is not None
