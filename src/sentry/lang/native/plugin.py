from __future__ import absolute_import, print_function

import posixpath

from sentry.models import Project
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import Symbolizer, have_symsynd


def exception_from_apple_error_or_diagnosis(error, diagnosis=None):
    error = error or {}

    if error:
        nsexception = error.get('nsexception')
        if nsexception:
            return {
                'type': nsexception['name'],
                'value': error['reason'],
            }

    if diagnosis:
        return {
            'type': 'Error',
            'value': diagnosis
        }


def inject_apple_backtrace(data, frames, diagnosis=None, error=None,
                           system=None):
    # TODO:
    #   user report stacktraces from unity

    app_uuid = None
    if system:
        app_uuid = system.get('app_uuid')
        if app_uuid is not None:
            app_uuid = app_uuid.lower()

    converted_frames = []
    longest_addr = 0
    for frame in reversed(frames):
        fn = frame.get('filename')
        in_app = False

        if app_uuid is not None:
            frame_uuid = frame.get('uuid')
            if frame_uuid == app_uuid:
                in_app = True

        # We only record the offset if we found a symbol but we did not
        # find a line number.  In that case it's the offset in bytes from
        # the beginning of the symbol.
        function = frame['symbol_name'] or '<unknown>'
        lineno = frame.get('line')
        offset = None
        if not lineno:
            offset = frame['instruction_addr'] - frame['symbol_addr']

        cframe = {
            'in_app': in_app,
            'abs_path': fn,
            'filename': fn and posixpath.basename(fn) or None,
            # This can come back as `None` from the symbolizer, in which
            # case we need to fill something else in or we will fail
            # later fulfill the interface requirements which say that a
            # function needs to be provided.
            'function': function,
            'package': frame['object_name'],
            'symbol_addr': '%x' % frame['symbol_addr'],
            'instruction_addr': '%x' % frame['instruction_addr'],
            'instruction_offset': offset,
            'lineno': lineno,
        }
        converted_frames.append(cframe)
        longest_addr = max(longest_addr, len(cframe['symbol_addr']),
                           len(cframe['instruction_addr']))

    # Pad out addresses to be of the same length and add prefix
    for frame in converted_frames:
        for key in 'symbol_addr', 'instruction_addr':
            frame[key] = '0x' + frame[key][2:].rjust(longest_addr, '0')

    stacktrace = {'frames': converted_frames}

    if error or diagnosis:
        if diagnosis is not None:
            data['culprit'] = diagnosis
        error = error or {}
        exc = exception_from_apple_error_or_diagnosis(error, diagnosis)
        if exc is not None:
            exc['stacktrace'] = stacktrace
            data['sentry.interfaces.Exception'] = exc
            return

    data['sentry.interfaces.Stacktrace'] = stacktrace


def preprocess_apple_crash_event(data):
    crash_report = data.get('sentry.interfaces.AppleCrashReport')
    if crash_report is None:
        return

    project = Project.objects.get_from_cache(
        id=data['project'],
    )

    crash = crash_report['crash']
    crashed_thread = None
    for thread in crash['threads']:
        if thread['crashed']:
            crashed_thread = thread
    if crashed_thread is None:
        return

    system = crash_report.get('system')
    sym = Symbolizer(project, crash_report['binary_images'],
                     threads=[crashed_thread])
    with sym:
        bt = sym.symbolize_backtrace(crashed_thread['backtrace']['contents'],
                                     system)
        inject_apple_backtrace(data, bt, crash.get('diagnosis'),
                               crash.get('error'), system)

    return data


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_preprocessors(self, **kwargs):
        if not have_symsynd:
            return []
        return [preprocess_apple_crash_event]
