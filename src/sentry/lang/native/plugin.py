from __future__ import absolute_import, print_function

import posixpath

from sentry.models import Project
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import make_symbolizer


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


def inject_apple_backtrace(data, frames, diagnosis=None, error=None):
    converted_frames = []
    for frame in converted_frames:
        fn = frame.get('filename')
        converted_frames.append({
            'abs_path': fn,
            'filename': fn and posixpath.basename(fn) or None,
            'function': frame['symbol_name'],
            'package': frame['object_name'],
            'lineno': frame.get('line'),
        })

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

    sym = make_symbolizer(project, crash_report['binary_images'])
    crash = crash_report['crash']

    bt = None
    for thread in crash['threads']:
        if thread['crashed']:
            with sym.driver:
                bt = sym.symbolize_backtrace(thread['backtrace']['contents'])

    if bt is not None:
        inject_apple_backtrace(data, bt, crash.get('diagnosis'),
                               crash.get('error'))

    return data


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_preprocessors(self, **kwargs):
        return [preprocess_apple_crash_event]
