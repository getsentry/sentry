from __future__ import absolute_import

import six

from symsynd.driver import Driver, SymbolicationError
from symsynd.report import ReportSymbolizer
from symsynd.macho.arch import get_cpu_name

from sentry.lang.native.dsymcache import dsymcache
from sentry.utils.safe import trim
from sentry.models import DSymSymbol, EventError
from sentry.constants import MAX_SYM


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

    def symbolize_app_frame(self, frame):
        img = self.images.get(frame['object_addr'])
        new_frame = self.symsynd_symbolizer.symbolize_frame(
            frame, silent=False, demangle=False)
        if new_frame is not None:
            return self._process_frame(new_frame, img)

    def symbolize_system_frame(self, frame, sdk_info):
        img = self.images.get(frame['object_addr'])
        if img is None:
            return

        symbol = find_system_symbol(img, frame['instruction_addr'],
                                    sdk_info)
        if symbol is None:
            return

        rv = dict(frame, symbol_name=symbol, filename=None,
                  line=0, column=0, uuid=img['uuid'],
                  object_name=img['name'])
        return self._process_frame(rv, img)

    def symbolize_frame(self, frame, sdk_info=None, report_error=None):
        # Step one: try to symbolize with cached dsym files.
        try:
            rv = self.symbolize_app_frame(frame)
            if rv is not None:
                return rv
        except SymbolicationError as e:
            if report_error is not None:
                report_error(e)

        # If that does not work, look up system symbols.
        rv = self.symbolize_system_frame(frame, sdk_info)
        if rv is not None:
            return rv

    def symbolize_backtrace(self, backtrace, sdk_info=None):
        rv = []
        errors = []
        idx = -1

        def report_error(e):
            errors.append({
                'type': EventError.NATIVE_INTERNAL_FAILURE,
                'frame': frm,
                'error': 'frame #%d: %s: %s' % (
                    idx,
                    e.__class__.__name__,
                    six.text_type(e),
                )
            })

        for idx, frm in enumerate(backtrace):
            rv.append(self.symbolize_frame(
                frm, sdk_info, report_error=report_error) or frm)
        return rv, errors
