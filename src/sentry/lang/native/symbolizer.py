from __future__ import absolute_import

import re
import six

from symsynd.driver import Driver, SymbolicationError
from symsynd.report import ReportSymbolizer
from symsynd.macho.arch import get_cpu_name

from sentry.lang.native.dsymcache import dsymcache
from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import DSymSymbol, EventError
from sentry.constants import MAX_SYM


APP_BUNDLE_PATHS = (
    '/var/containers/Bundle/Application/',
    '/private/var/containers/Bundle/Application/',
)
_sim_platform_re = re.compile(r'/\w+?Simulator\.platform/')
_known_app_bundled_frameworks_re = re.compile(r'''(?x)
    /Frameworks/(
            libswift([a-zA-Z0-9]+)\.dylib$
        |   (KSCrash|SentrySwift)\.framework/
    )
''')
SIM_PATH = '/Developer/CoreSimulator/Devices/'
SIM_APP_PATH = '/Containers/Bundle/Application/'


@implements_to_string
class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, image=None):
        Exception.__init__(self)
        self.message = six.text_type(message)
        self.type = type
        if image is not None:
            self.image_uuid = image['uuid']
            self.image_name = image['name'].rsplit('/', 1)[-1]
        else:
            self.image_uuid = None
            self.image_name = None

    @property
    def is_user_fixable(self):
        """These are errors that a user can fix themselves."""
        return self.type in ('missing-dsym', 'bad-dsym')

    @property
    def is_sdk_failure(self):
        """An error that most likely happened because of a bad SDK."""
        return self.type == 'unknown-image'

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


def find_system_symbol(img, instruction_addr, sdk_info=None):
    """Finds a system symbol."""
    return DSymSymbol.objects.lookup_symbol(
        instruction_addr=instruction_addr,
        image_addr=img['image_addr'],
        image_vmaddr=img['image_vmaddr'],
        uuid=img['uuid'],
        cpu_name=get_cpu_name(img['cpu_type'],
                              img['cpu_subtype']),
        object_path=img['name'],
        sdk_info=sdk_info
    )


def make_symbolizer(project, binary_images, referenced_images=None):
    """Creates a symbolizer for the given project and binary images.  If a
    list of referenced images is referenced (UUIDs) then only images
    needed by those frames are loaded.
    """
    driver = Driver()

    to_load = referenced_images
    if to_load is None:
        to_load = [x['uuid'] for x in binary_images]

    dsym_paths, loaded = dsymcache.fetch_dsyms(project, to_load)

    # We only want to pass the actually loaded symbols to the report
    # symbolizer to avoid the expensive FS operations that will otherwise
    # happen.
    user_images = []
    for img in binary_images:
        if img['uuid'] in loaded:
            user_images.append(img)

    return ReportSymbolizer(driver, dsym_paths, user_images)


class Symbolizer(object):

    def __init__(self, project, binary_images, referenced_images=None):
        self.symsynd_symbolizer = make_symbolizer(
            project, binary_images, referenced_images=referenced_images)
        self.images = dict((img['image_addr'], img) for img in binary_images)

    def __enter__(self):
        return self.symsynd_symbolizer.driver.__enter__()

    def __exit__(self, *args):
        return self.symsynd_symbolizer.driver.__exit__(*args)

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

    def _is_app_bundled_frame(self, frame, img):
        fn = self._get_frame_package(frame, img)
        if not (fn.startswith(APP_BUNDLE_PATHS) or
                (SIM_PATH in fn and SIM_APP_PATH in fn)):
            return False
        return True

    def _is_app_frame(self, frame, img):
        if not self._is_app_bundled_frame(frame, img):
            return False
        fn = self._get_frame_package(frame, img)
        # Ignore known frameworks
        match = _known_app_bundled_frameworks_re.search(fn)
        if match is not None:
            return False
        return True

    def _is_simulator_frame(self, frame, img):
        fn = self._get_frame_package(frame, img)
        return _sim_platform_re.search(fn) is not None

    def is_in_app(self, frame):
        img = self.images.get(frame['object_addr'])
        return img is not None and self._is_app_frame(frame, img)

    def symbolize_app_frame(self, frame, img):
        if frame['object_addr'] not in self.symsynd_symbolizer.images:
            raise SymbolicationFailed(
                type='missing-dsym',
                message=(
                    'Frame references a missing dSYM file.'
                ),
                image=img
            )

        try:
            new_frame = self.symsynd_symbolizer.symbolize_frame(
                frame, silent=False, demangle=False)
        except SymbolicationError as e:
            raise SymbolicationFailed(
                type='bad-dsym',
                message='Symbolication failed due to bad dsym: %s' % e,
                image=img
            )

        if new_frame is None:
            raise SymbolicationFailed(
                type='missing-symbol',
                message=(
                    'Upon symbolication a frame could not be resolved.'
                ),
                image=img
            )

        return self._process_frame(new_frame, img)

    def symbolize_system_frame(self, frame, img, sdk_info):
        """Symbolizes a frame with system symbols only."""
        symbol = find_system_symbol(img, frame['instruction_addr'], sdk_info)
        if symbol is None:
            # Simulator frames cannot be symbolicated
            if self._is_simulator_frame(frame, img):
                type = 'simulator-frame'
                message = 'Cannot symbolicate simulator system frames.'
            else:
                type = 'missing-system-dsym'
                message = (
                    'Attempted to look up system in the system symbols but '
                    'no symbol could be found.  This might happen with beta '
                    'releases of SDKs.'
                )
            raise SymbolicationFailed(
                type=type,
                message=message,
                image=img
            )

        rv = dict(frame, symbol_name=symbol, filename=None,
                  line=0, column=0, uuid=img['uuid'],
                  object_name=img['name'])
        return self._process_frame(rv, img)

    def symbolize_frame(self, frame, sdk_info=None):
        img = self.images.get(frame['object_addr'])
        if img is None:
            raise SymbolicationFailed(
                type='unknown-image',
                message=(
                    'The stacktrace referred to an object at an address '
                    'that was not registered in the debug meta information.'
                )
            )

        # If we are dealing with a frame that is not bundled with the app
        # we look at system symbols.  If that fails, we go to looking for
        # app symbols explicitly.
        if not self._is_app_bundled_frame(frame, img):
            return self.symbolize_system_frame(frame, img, sdk_info)

        return self.symbolize_app_frame(frame, img)

    def symbolize_backtrace(self, backtrace, sdk_info=None):
        rv = []
        errors = []
        idx = -1

        for idx, frm in enumerate(backtrace):
            try:
                rv.append(self.symbolize_frame(frm, sdk_info) or frm)
            except SymbolicationFailed as e:
                errors.append({
                    'type': EventError.NATIVE_INTERNAL_FAILURE,
                    'frame': frm,
                    'error': u'frame #%d: %s' % (idx, e),
                })
        return rv, errors
