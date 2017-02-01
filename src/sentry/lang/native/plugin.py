from __future__ import absolute_import

import os
import re
import sys
import six
import time
import logging
import posixpath

from symsynd.demangle import demangle_symbol

from sentry.models import Project, EventError
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import Symbolizer, SymbolicationFailed
from sentry.lang.native.utils import find_all_stacktraces, \
    find_apple_crash_report_referenced_images, get_sdk_from_event, \
    find_stacktrace_referenced_images, get_sdk_from_apple_system_info, \
    APPLE_SDK_MAPPING
from sentry.utils.native import parse_addr


logger = logging.getLogger(__name__)

model_re = re.compile(r'^(\S+?)\d')

APP_BUNDLE_PATHS = (
    '/var/containers/Bundle/Application/',
    '/private/var/containers/Bundle/Application/',
)
SIM_PATH = '/Developer/CoreSimulator/Devices/'
SIM_APP_PATH = '/Containers/Bundle/Application/'

NON_APP_FRAMEWORKS = (
    '/Frameworks/libswiftCore.dylib',
)

SIGNAL_NAMES = {
    1: 'SIGHUP',
    2: 'SIGINT',
    3: 'SIGQUIT',
    4: 'SIGILL',
    5: 'SIGTRAP',
    6: 'SIGABRT',
    7: 'SIGEMT',
    8: 'SIGFPE',
    9: 'SIGKILL',
    10: 'SIGBUS',
    11: 'SIGSEGV',
    12: 'SIGSYS',
    13: 'SIGPIPE',
    14: 'SIGALRM',
    15: 'SIGTERM',
    16: 'SIGURG',
    17: 'SIGSTOP',
    18: 'SIGTSTP',
    19: 'SIGCONT',
    20: 'SIGCHLD',
    21: 'SIGTTIN',
    22: 'SIGTTOU',
    24: 'SIGXCPU',
    25: 'SIGXFSZ',
    26: 'SIGVTALRM',
    27: 'SIGPROF',
    28: 'SIGWINCH',
    29: 'SIGINFO',
    31: 'SIGUSR2',
}


def append_error(data, err):
    data.setdefault('errors', []).append(err)


def process_posix_signal(data):
    signal = data.get('signal', -1)
    signal_name = data.get('name')
    if signal_name is None:
        signal_name = SIGNAL_NAMES.get(signal)
    return {
        'signal': signal,
        'name': signal_name,
        'code': data.get('code'),
        'code_name': data.get('code_name'),
    }


def exception_from_apple_error_or_diagnosis(error, diagnosis=None):
    rv = {}
    error = error or {}

    mechanism = {}
    if 'mach' in error:
        mechanism['mach_exception'] = error['mach']
    if 'signal' in error:
        mechanism['posix_signal'] = process_posix_signal(error['signal'])
    if mechanism:
        mechanism.setdefault('type', 'cocoa')
        rv['mechanism'] = mechanism

    # Start by getting the error from nsexception
    if error:
        nsexception = error.get('nsexception')
        if nsexception:
            rv['type'] = nsexception['name']
            if 'value' in nsexception:
                rv['value'] = nsexception['value']

    # If we don't have an error yet, try to build one from reason and
    # diagnosis
    if 'value' not in rv:
        if 'reason' in error:
            rv['value'] = error['reason']
        elif 'diagnosis' in error:
            rv['value'] = error['diagnosis']
        elif 'mach_exception' in mechanism:
            rv['value'] = mechanism['mach_exception'] \
                .get('exception_name') or 'Mach Exception'
        elif 'posix_signal' in mechanism:
            rv['value'] = mechanism['posix_signal'] \
                .get('name') or 'Posix Signal'
        else:
            rv['value'] = 'Unknown'

    # Figure out a reasonable type
    if 'type' not in rv:
        if 'mach_exception' in mechanism:
            rv['type'] = 'MachException'
        elif 'posix_signal' in mechanism:
            rv['type'] = 'Signal'
        else:
            rv['type'] = 'Unknown'

    if rv:
        return rv


def is_in_app(frame, app_uuid=None):
    if app_uuid is not None:
        frame_uuid = frame.get('uuid')
        if frame_uuid == app_uuid:
            return True
    fn = frame.get('package') or ''
    if not (fn.startswith(APP_BUNDLE_PATHS) or
            (SIM_PATH in fn and SIM_APP_PATH in fn)):
        return False
    if fn.endswith(NON_APP_FRAMEWORKS):
        return False
    return True


def convert_stacktrace(frames, system=None, notable_addresses=None):
    app_uuid = None
    if system:
        app_uuid = system.get('app_uuid')
        if app_uuid is not None:
            app_uuid = app_uuid.lower()

    converted_frames = []
    for frame in reversed(frames):
        fn = frame.get('filename')

        # We only record the offset if we found a symbol but we did not
        # find a line number.  In that case it's the offset in bytes from
        # the beginning of the symbol.
        function = frame.get('symbol_name') or '<unknown>'
        lineno = frame.get('line')
        offset = None
        if not lineno:
            offset = frame['instruction_addr'] - frame['symbol_addr']

        cframe = {
            'abs_path': fn,
            'filename': fn and posixpath.basename(fn) or None,
            # This can come back as `None` from the symbolizer, in which
            # case we need to fill something else in or we will fail
            # later fulfill the interface requirements which say that a
            # function needs to be provided.
            'function': function,
            'package': frame.get('object_name'),
            'symbol_addr': '0x%x' % frame['symbol_addr'],
            'instruction_addr': '0x%x' % frame['instruction_addr'],
            'instruction_offset': offset,
            'lineno': lineno,
        }
        cframe['in_app'] = is_in_app(cframe, app_uuid)
        converted_frames.append(cframe)

    if converted_frames and notable_addresses:
        converted_frames[-1]['vars'] = notable_addresses

    if converted_frames:
        return {'frames': converted_frames}


def inject_apple_backtrace(data, frames, diagnosis=None, error=None,
                           system=None, notable_addresses=None,
                           thread_id=None):
    stacktrace = convert_stacktrace(frames, system, notable_addresses)

    if error or diagnosis:
        error = error or {}
        exc = exception_from_apple_error_or_diagnosis(error, diagnosis)
        if exc is not None:
            exc['stacktrace'] = stacktrace
            exc['thread_id'] = thread_id
            data['sentry.interfaces.Exception'] = {'values': [exc]}
            # Since we inject the exception late we need to make sure that
            # we set the event type to error as it would be set to
            # 'default' otherwise.
            data['type'] = 'error'
            return True

    data['sentry.interfaces.Stacktrace'] = stacktrace
    return False


def inject_apple_device_data(data, system):
    contexts = data.setdefault('contexts', {})

    device = contexts.setdefault('device', {})
    os = contexts.setdefault('os', {})

    try:
        os['name'] = APPLE_SDK_MAPPING[system['system_name']]
    except LookupError:
        os['name'] = system.get('system_name') or 'Generic Apple'

    if 'system_version' in system:
        os['version'] = system['system_version']
    if 'os_version' in system:
        os['build'] = system['os_version']
    if 'kernel_version' in system:
        os['kernel_version'] = system['kernel_version']
    if 'jailbroken' in system:
        os['rooted'] = system['jailbroken']

    if 'cpu_arch' in system:
        device['arch'] = system['cpu_arch']
    if 'model' in system:
        device['model_id'] = system['model']
    if 'machine' in system:
        device['model'] = system['machine']
        match = model_re.match(system['machine'])
        if match is not None:
            device['family'] = match.group(1)


def dump_crash_report(report):
    import json
    with open('/tmp/sentry-apple-crash-report-%s.json' % time.time(), 'w') as f:
        json.dump(report, f, indent=2)


def preprocess_apple_crash_event(data):
    """This processes the "legacy" AppleCrashReport."""
    crash_report = data['sentry.interfaces.AppleCrashReport']

    if os.environ.get('SENTRY_DUMP_APPLE_CRASH_REPORT') == '1':
        dump_crash_report(crash_report)

    project = Project.objects.get_from_cache(
        id=data['project'],
    )

    system = None
    errors = []
    threads = []
    crash = crash_report['crash']
    crashed_thread = None

    threads = {}
    raw_threads = {}
    for raw_thread in crash['threads']:
        if raw_thread['crashed'] and raw_thread.get('backtrace'):
            crashed_thread = raw_thread
        raw_threads[raw_thread['index']] = raw_thread
        threads[raw_thread['index']] = {
            'id': raw_thread['index'],
            'name': raw_thread.get('name'),
            'current': raw_thread.get('current_thread', False),
            'crashed': raw_thread.get('crashed', False),
        }

    sdk_info = get_sdk_from_apple_system_info(system)
    referenced_images = find_apple_crash_report_referenced_images(
        crash_report['binary_images'], raw_threads.values())
    sym = Symbolizer(project, crash_report['binary_images'],
                     referenced_images=referenced_images)

    with sym:
        if crashed_thread is None:
            append_error(data, {
                'type': EventError.NATIVE_NO_CRASHED_THREAD,
            })
        else:
            system = crash_report.get('system')
            try:
                bt, errors = sym.symbolize_backtrace(
                    crashed_thread['backtrace']['contents'], sdk_info)
                for error in errors:
                    append_error(data, error)
                if inject_apple_backtrace(data, bt, crash.get('diagnosis'),
                                          crash.get('error'), system,
                                          crashed_thread.get('notable_addresses'),
                                          crashed_thread['index']):
                    # We recorded an exception, so in this case we can
                    # skip having the stacktrace.
                    threads[crashed_thread['index']]['stacktrace'] = None
            except Exception:
                logger.exception('Failed to symbolicate')
                errors.append({
                    'type': EventError.NATIVE_INTERNAL_FAILURE,
                    'error': 'The symbolicator encountered an internal failure',
                })

        for thread in six.itervalues(threads):
            # If we were told to skip the stacktrace, skip it indeed
            if thread.get('stacktrace', Ellipsis) is None:
                continue
            raw_thread = raw_threads.get(thread['id'])
            if raw_thread is None or not raw_thread.get('backtrace'):
                continue
            bt, errors = sym.symbolize_backtrace(
                raw_thread['backtrace']['contents'], sdk_info)
            for error in errors:
                append_error(data, error)
            thread['stacktrace'] = convert_stacktrace(
                bt, system, raw_thread.get('notable_addresses'))

    if threads:
        data['threads'] = {
            'values': sorted(threads.values(), key=lambda x: x['id']),
        }

    if system:
        inject_apple_device_data(data, system)

    return data


def resolve_frame_symbols(data):
    debug_meta = data['debug_meta']
    debug_images = debug_meta['images']
    sdk_info = get_sdk_from_event(data)

    stacktraces = find_all_stacktraces(data)
    if not stacktraces:
        return

    project = Project.objects.get_from_cache(
        id=data['project'],
    )

    errors = []
    referenced_images = find_stacktrace_referenced_images(
        debug_images, [x[0] for x in stacktraces])
    sym = Symbolizer(project, debug_images,
                     referenced_images=referenced_images)

    frame = None
    idx = -1

    def report_error(exc_type, exc_value, tb):
        if exc_value.is_user_fixable or exc_value.is_sdk_failure:
            errors.append({
                'type': EventError.NATIVE_INTERNAL_FAILURE,
                'frame': frame,
                'error': u'frame #%d: %s' % (idx, exc_value)
            })
        if not exc_value.is_user_fixable:
            logger.debug('Failed to symbolicate',
                         exc_info=(exc_type, exc_value, tb))

    with sym:
        for stacktrace, container in stacktraces:
            store_raw = False

            new_frames = list(stacktrace['frames'])
            for idx, frame in enumerate(stacktrace['frames']):
                if 'image_addr' not in frame or \
                   'instruction_addr' not in frame or \
                   'symbol_addr' not in frame:
                    continue
                try:
                    # Construct a raw frame that is used by the symbolizer
                    # backend.
                    raw_frame = {
                        'object_name': frame.get('package'),
                        'object_addr': frame['image_addr'],
                        'instruction_addr': frame['instruction_addr'],
                        'symbol_addr': frame['symbol_addr'],
                    }
                    new_frame = dict(frame)

                    try:
                        sfrm = sym.symbolize_frame(raw_frame, sdk_info)
                    except SymbolicationFailed:
                        report_error(*sys.exc_info())
                    else:
                        symbol = sfrm.get('symbol_name') or \
                            new_frame.get('function') or '<unknown>'
                        function = demangle_symbol(symbol, simplified=True)

                        new_frame['function'] = function

                        # If we demangled something, store the original in the
                        # symbol portion of the frame
                        if function != symbol:
                            new_frame['symbol'] = symbol

                        new_frame['abs_path'] = sfrm.get('filename') or None
                        if new_frame['abs_path']:
                            new_frame['filename'] = posixpath.basename(
                                new_frame['abs_path'])
                        if sfrm.get('line') is not None:
                            new_frame['lineno'] = sfrm['line']
                        else:
                            new_frame['instruction_offset'] = \
                                parse_addr(sfrm['instruction_addr']) - \
                                parse_addr(sfrm['symbol_addr'])
                        if sfrm.get('column') is not None:
                            new_frame['colno'] = sfrm['column']
                        new_frame['package'] = sfrm['object_name'] \
                            or new_frame.get('package')
                        new_frame['symbol_addr'] = '0x%x' % \
                            parse_addr(sfrm['symbol_addr'])
                        new_frame['instruction_addr'] = '0x%x' % parse_addr(
                            sfrm['instruction_addr'])

                    new_frame['in_app'] = sym.is_in_app(raw_frame)
                    if new_frame != frame:
                        new_frames[idx] = new_frame
                        store_raw = True
                except Exception:
                    logger.exception('Failed to symbolicate')
                    errors.append({
                        'type': EventError.NATIVE_INTERNAL_FAILURE,
                        'error': 'The symbolicator encountered an internal failure',
                    })

            # Remember the raw stacktrace.
            if store_raw and container is not None:
                container['raw_stacktrace'] = {
                    'frames': stacktrace['frames'],
                }

            # Put the new frames in
            stacktrace['frames'] = new_frames

    if errors:
        data.setdefault('errors', []).extend(errors)

    return data


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_preprocessors(self, data, **kwargs):
        rv = []
        if data.get('sentry.interfaces.AppleCrashReport'):
            rv.append(preprocess_apple_crash_event)
        if data.get('debug_meta'):
            rv.append(resolve_frame_symbols)
        return rv
