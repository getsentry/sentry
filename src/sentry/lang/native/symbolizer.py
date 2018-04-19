from __future__ import absolute_import

import re
import six

from symbolic import SymbolicError, ObjectLookup, LineInfo, parse_addr

from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import EventError, ProjectDSymFile
from sentry.lang.native.utils import image_name, rebase_addr
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
MAC_OS_PATHS = (
    '.app/Contents/',
    '/Users/',
    '/usr/local/',
)
LINUX_SYS_PATHS = (
    '/lib/',
    '/usr/lib/',
    'linux-gate.so',
)
WINDOWS_SYS_PATH = re.compile(r'^[a-z]:\\windows', re.IGNORECASE)

_internal_function_re = re.compile(
    r'(kscm_|kscrash_|KSCrash |SentryClient |RNSentry )')

KNOWN_GARBAGE_SYMBOLS = set([
    '_mh_execute_header',
    '<redacted>',
    NATIVE_UNKNOWN_STRING,
])


@implements_to_string
class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, obj=None):
        Exception.__init__(self)
        self.message = six.text_type(message)
        self.type = type
        self.image_name = None
        self.image_path = None
        if obj is not None:
            self.image_uuid = six.text_type(obj.id)
            if obj.name:
                self.image_path = obj.name
                self.image_name = image_name(obj.name)
            self.image_arch = obj.arch
        else:
            self.image_uuid = None
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

    def get_data(self):
        """Returns the event data."""
        rv = {'message': self.message, 'type': self.type}
        if self.image_path is not None:
            rv['image_path'] = self.image_path
        if self.image_uuid is not None:
            rv['image_uuid'] = self.image_uuid
        if self.image_arch is not None:
            rv['image_arch'] = self.image_arch
        return rv

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
    """This symbolizer dispatches to both symbolic and the system symbols
    we have in the database and reports errors slightly differently.
    """

    def __init__(self, project, object_lookup, referenced_images,
                 on_dsym_file_referenced=None):
        if not isinstance(object_lookup, ObjectLookup):
            object_lookup = ObjectLookup(object_lookup)
        self.object_lookup = object_lookup

        self.symcaches, self.symcaches_conversion_errors = \
            ProjectDSymFile.dsymcache.get_symcaches(
                project, referenced_images,
                on_dsym_file_referenced=on_dsym_file_referenced,
                with_conversion_errors=True)

    def _process_frame(self, sym, obj, package=None, addr_off=0):
        frame = {
            'sym_addr': sym.sym_addr + addr_off,
            'instruction_addr': sym.instr_addr + addr_off,
            'lineno': sym.line,
        }
        symbol = trim(sym.symbol, MAX_SYM)
        function = trim(sym.function_name, MAX_SYM)

        frame['function'] = function
        if function != symbol:
            frame['symbol'] = symbol
        else:
            frame['symbol'] = None

        frame['filename'] = trim(sym.rel_path, 256)
        frame['abs_path'] = trim(sym.abs_path, 256)
        if package is not None:
            frame['package'] = package

        return frame

    def is_image_from_app_bundle(self, obj, sdk_info=None):
        obj_path = obj.name
        if not obj_path:
            return False

        if obj_path.startswith(APP_BUNDLE_PATHS):
            return True

        if SIM_PATH in obj_path and SIM_APP_PATH in obj_path:
            return True

        sdk_name = sdk_info['sdk_name'].lower() if sdk_info else ''
        if sdk_name == 'macos' and any(p in obj_path for p in MAC_OS_PATHS):
            return True
        if sdk_name == 'linux' and not obj_path.startswith(LINUX_SYS_PATHS):
            return True
        if sdk_name == 'windows' and not WINDOWS_SYS_PATH.match(obj_path):
            return True

        return False

    def _is_support_framework(self, obj):
        """True if the frame is from a framework that is known and app
        bundled.  Those are frameworks which are specifically not frameworks
        that are ever in_app.
        """
        return obj.name and _support_framework.search(obj.name) is not None

    def _is_app_bundled_framework(self, obj):
        fn = obj.name
        return fn and fn.startswith(APP_BUNDLE_PATHS) and '/Frameworks/' in fn

    def _is_app_frame(self, instruction_addr, obj, sdk_info=None):
        """Given a frame derives the value of `in_app` by discarding the
        original value of the frame.
        """
        # Anything that is outside the app bundle is definitely not a
        # frame from out app.
        if not self.is_image_from_app_bundle(obj, sdk_info=sdk_info):
            return False

        # We also do not consider known support frameworks to be part of
        # the app
        if self._is_support_framework(obj):
            return False

        # Otherwise, yeah, let's just say it's in_app
        return True

    def _is_optional_dsym(self, obj, sdk_info=None):
        """Checks if this is a dsym that is optional."""
        # Frames that are not in the app are not considered optional.  In
        # theory we should never reach this anyways.
        if not self.is_image_from_app_bundle(obj, sdk_info=sdk_info):
            return False

        # If we're dealing with an app bundled framework that is also
        # considered optional.
        if self._is_app_bundled_framework(obj):
            return True

        # Frameworks that are known to sentry and bundled helpers are always
        # optional for now.  In theory this should always be False here
        # because we should catch it with the last branch already.
        if self._is_support_framework(obj):
            return True

        return False

    def _is_simulator_frame(self, frame, obj):
        return obj.name and _sim_platform_re.search(obj.name) is not None

    def _symbolize_app_frame(self, instruction_addr, obj, sdk_info=None):
        symcache = self.symcaches.get(obj.id)
        if symcache is None:
            # In case we know what error happened on symcache conversion
            # we can report it to the user now.
            if obj.id in self.symcaches_conversion_errors:
                raise SymbolicationFailed(
                    message=self.symcaches_conversion_errors[obj.id],
                    type=EventError.NATIVE_BAD_DSYM,
                    obj=obj
                )
            if self._is_optional_dsym(obj, sdk_info=sdk_info):
                type = EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM
            else:
                type = EventError.NATIVE_MISSING_DSYM
            raise SymbolicationFailed(type=type, obj=obj)

        try:
            rv = symcache.lookup(rebase_addr(instruction_addr, obj))
        except SymbolicError as e:
            raise SymbolicationFailed(
                type=EventError.NATIVE_BAD_DSYM, message=six.text_type(e), obj=obj
            )

        if not rv:
            # For some frameworks we are willing to ignore missing symbol
            # errors.
            if self._is_optional_dsym(obj, sdk_info=sdk_info):
                return []
            raise SymbolicationFailed(
                type=EventError.NATIVE_MISSING_SYMBOL, obj=obj)
        return [self._process_frame(s, obj, addr_off=obj.addr) for s in reversed(rv)]

    def _convert_symbolserver_match(self, instruction_addr, symbolserver_match, obj):
        """Symbolizes a frame with system symbols only."""
        if symbolserver_match is None:
            return []

        symbol = symbolserver_match['symbol']
        if symbol[:1] == '_':
            symbol = symbol[1:]

        return [
            self._process_frame(LineInfo(
                sym_addr=parse_addr(symbolserver_match['addr']),
                instr_addr=parse_addr(instruction_addr),
                line=None,
                lang=None,
                symbol=symbol,
            ), obj, package=symbolserver_match['object_name'])
        ]

    def symbolize_frame(self, instruction_addr, sdk_info=None, symbolserver_match=None):
        obj = self.object_lookup.find_object(instruction_addr)
        if obj is None:
            raise SymbolicationFailed(type=EventError.NATIVE_UNKNOWN_IMAGE)

        # If we are dealing with a frame that is not bundled with the app
        # we look at system symbols.  If that fails, we go to looking for
        # app symbols explicitly.
        if not self.is_image_from_app_bundle(obj, sdk_info=sdk_info):
            return self._convert_symbolserver_match(instruction_addr, symbolserver_match, obj)

        return self._symbolize_app_frame(instruction_addr, obj, sdk_info=sdk_info)

    def is_in_app(self, instruction_addr, sdk_info=None):
        obj = self.object_lookup.find_object(instruction_addr)
        return obj is not None and self._is_app_frame(instruction_addr, obj, sdk_info=sdk_info)

    def is_internal_function(self, function):
        return _internal_function_re.search(function) is not None
