from __future__ import absolute_import

import os
import re
import six
import time
import logging
import posixpath

from symsynd.demangle import demangle_symbol
from symsynd.heuristics import find_best_instruction
from symsynd.utils import parse_addr

from sentry import options
from django.db import transaction, IntegrityError
from sentry.models import Project, EventError, VersionDSymFile, DSymPlatform, \
    DSymApp
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import Symbolizer, SymbolicationFailed, \
    ImageLookup
from sentry.lang.native.utils import \
    find_apple_crash_report_referenced_images, get_sdk_from_event, \
    get_sdk_from_apple_system_info, cpu_name_from_data, APPLE_SDK_MAPPING, \
    rebase_addr, version_build_from_data
from sentry.lang.native.systemsymbols import lookup_system_symbols
from sentry.utils import metrics
from sentry.stacktraces import StacktraceProcessor
from sentry.reprocessing import report_processing_issue
from sentry.constants import NATIVE_UNKNOWN_STRING


logger = logging.getLogger(__name__)


FRAME_CACHE_VERSION = 4
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
    # XXX: kill me
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
    # XXX: kill me
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
    # XXX: kill me
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
    # XXX: kill me
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
        function = frame.get('symbol_name') or NATIVE_UNKNOWN_STRING
        lineno = frame.get('line')

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
                     cpu_name=cpu_name_from_data(data),
                     referenced_images=referenced_images)

    try:
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
    finally:
        sym.close()

    if threads:
        data['threads'] = {
            'values': sorted(threads.values(), key=lambda x: x['id']),
        }

    if system:
        inject_apple_device_data(data, system)

    return data


class NativeStacktraceProcessor(StacktraceProcessor):

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)
        debug_meta = self.data.get('debug_meta')
        self.cpu_name = cpu_name_from_data(self.data)
        self.sym = None
        self.dsyms_referenced = set()
        if debug_meta:
            self.available = True
            self.debug_meta = debug_meta
            self.sdk_info = get_sdk_from_event(self.data)
            self.image_lookup = ImageLookup(self.debug_meta['images'])
        else:
            self.available = False

    def close(self):
        StacktraceProcessor.close(self)
        if self.dsyms_referenced:
            metrics.incr('dsyms.processed',
                         amount=len(self.dsyms_referenced),
                         instance=self.project.id)
        if self.sym is not None:
            self.sym.close()
            self.sym = None

    def find_best_instruction(self, processable_frame):
        """Given a frame, stacktrace info and frame index this returns the
        interpolated instruction address we then use for symbolication later.
        """
        if self.cpu_name is None:
            return parse_addr(processable_frame['instruction_addr'])
        meta = None

        # We only need to provide meta information for frame zero
        if processable_frame.idx == 0:
            # The signal is useful information for symsynd in some situations
            # to disambiugate the first frame.  If we can get this information
            # from the mechanism we want to pass it onwards.
            signal = None
            exc = self.data.get('sentry.interfaces.Exception')
            if exc is not None:
                mechanism = exc['values'][0].get('mechanism')
                if mechanism and 'posix_signal' in mechanism and \
                   'signal' in mechanism['posix_signal']:
                    signal = mechanism['posix_signal']['signal']
            meta = {
                'frame_number': 0,
                'registers': processable_frame.stacktrace_info.stacktrace.get('registers'),
                'signal': signal,
            }

        return find_best_instruction(
            processable_frame['instruction_addr'],
            self.cpu_name, meta=meta)

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (
            platform == 'cocoa' and
            self.available and
            'instruction_addr' in frame
        )

    def preprocess_frame(self, processable_frame):
        instr_addr = self.find_best_instruction(processable_frame)
        img = self.image_lookup.find_image(instr_addr)

        processable_frame.data = {
            'instruction_addr': instr_addr,
            'image': img,
            'image_uuid': img['uuid'] if img is not None else None,
            'symbolserver_match': None,
        }

        if img is not None:
            processable_frame.set_cache_key_from_values((
                FRAME_CACHE_VERSION,
                # Because the images can move around, we want to rebase
                # the address for the cache key to be within the image
                # the same way as we do it in the symbolizer.
                rebase_addr(instr_addr, img),
                img['uuid'].lower(),
                img['cpu_type'],
                img['cpu_subtype'],
                img['image_size'],
            ))

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        referenced_images = set(
            pf.data['image_uuid']
            for pf in processing_task.iter_processable_frames(self)
            if pf.cache_value is None and pf.data['image_uuid'] is not None)

        def on_referenced(dsym_file):
            app_info = version_build_from_data(self.data)
            if app_info is not None:
                dsym_app = DSymApp.objects.create_or_update_app(
                    sync_id=None,
                    app_id=app_info.id,
                    project=self.project,
                    data={'name': app_info.name},
                    platform=DSymPlatform.APPLE,
                )
                try:
                    with transaction.atomic():
                        version_dsym_file, created = VersionDSymFile.objects.get_or_create(
                            dsym_file=dsym_file,
                            dsym_app=dsym_app,
                            version=app_info.version,
                            build=app_info.build,
                        )
                except IntegrityError:
                    # XXX: this can currently happen because we only
                    # support one app per dsym file.  Since this can
                    # happen in some cases anyways we ignore it.
                    pass

        self.sym = Symbolizer(self.project, self.image_lookup,
                              cpu_name=self.cpu_name,
                              referenced_images=referenced_images,
                              on_dsym_file_referenced=on_referenced)

        # The symbolizer gets a reference to the debug meta's images so
        # when it resolves the missing vmaddrs it changes them in the data
        # dict.
        data = self.sym.resolve_missing_vmaddrs()

        if options.get('symbolserver.enabled'):
            self.fetch_system_symbols(processing_task)

        return data

    def fetch_system_symbols(self, processing_task):
        to_lookup = []
        pf_list = []
        for pf in processing_task.iter_processable_frames(self):
            img = pf.data['image']
            if pf.cache_value is not None or img is None or \
               self.sym.is_frame_from_app_bundle(pf.frame, img):
                continue
            to_lookup.append({
                'object_uuid': img['uuid'],
                'object_name': img['name'],
                'addr': '0x%x' % rebase_addr(pf.data['instruction_addr'], img)
            })
            pf_list.append(pf)

        if not to_lookup:
            return

        rv = lookup_system_symbols(to_lookup, self.sdk_info,
                                   self.sym.cpu_name)
        if rv is not None:
            for symrv, pf in zip(rv, pf_list):
                if symrv is None:
                    continue
                pf.data['symbolserver_match'] = symrv

    def process_frame(self, processable_frame, processing_task):
        frame = processable_frame.frame
        errors = []

        new_frames = []
        raw_frame = dict(frame)
        if processable_frame.cache_value is None:
            # Construct a raw frame that is used by the symbolizer
            # backend.  We only assemble the bare minimum we need here.
            sym_input_frame = {
                'object_name': frame.get('package'),
                'instruction_addr': processable_frame.data['instruction_addr'],
                'symbol_name': frame.get('function'),
            }
            in_app = self.sym.is_in_app(sym_input_frame)
            raw_frame['in_app'] = in_app
            img_uuid = processable_frame.data['image_uuid']
            if img_uuid is not None:
                self.dsyms_referenced.add(img_uuid)
            try:
                symbolicated_frames = self.sym.symbolize_frame(
                    sym_input_frame, self.sdk_info,
                    symbolserver_match=processable_frame.data['symbolserver_match'],
                    symbolize_inlined=True)
                if not symbolicated_frames:
                    return None, [raw_frame], []
            except SymbolicationFailed as e:
                reprocessing_active = False
                if self.project:
                    reprocessing_active = bool(
                        self.project.get_option('sentry:reprocessing_active', False)
                    )
                # User fixable but fatal errors are reported as processing
                # issues but only if the feature is activated.
                if reprocessing_active and e.is_user_fixable and e.is_fatal:
                    report_processing_issue(self.data,
                        scope='native',
                        object='dsym:%s' % e.image_uuid,
                        type=e.type,
                        data={
                            'image_path': e.image_path,
                            'image_uuid': e.image_uuid,
                            'image_arch': e.image_arch,
                            'message': e.message,
                        }
                    )

                # This in many ways currently does not really do anything.
                # The reason is that once a processing issue is reported
                # the event will only be stored as a raw event and no
                # group will be generated.  As a result it also means that
                # we will not have any user facing event or error showing
                # up at all.  We want to keep this here though in case we
                # do not want to report some processing issues (eg:
                # optional dsyms)
                errors = []
                if e.is_user_fixable or e.is_sdk_failure:
                    errors.append({
                        'type': e.type,
                        'image_uuid': e.image_uuid,
                        'image_path': e.image_path,
                        'image_arch': e.image_arch,
                        'message': e.message,
                    })
                else:
                    logger.debug('Failed to symbolicate with native backend',
                                 exc_info=True)
                return [raw_frame], [raw_frame], errors

            processable_frame.set_cache_value([in_app, symbolicated_frames])
        else:
            in_app, symbolicated_frames = processable_frame.cache_value
            raw_frame['in_app'] = in_app

        for sfrm in symbolicated_frames:
            symbol = sfrm.get('symbol_name') or \
                frame.get('function') or NATIVE_UNKNOWN_STRING
            function = demangle_symbol(symbol, simplified=True)

            new_frame = dict(frame)
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
            if sfrm.get('column') is not None:
                new_frame['colno'] = sfrm['column']
            new_frame['package'] = sfrm['object_name'] \
                or new_frame.get('package')
            new_frame['in_app'] = in_app
            new_frames.append(new_frame)

        return new_frames, [raw_frame], []


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_preprocessors(self, data, **kwargs):
        rv = []
        if data.get('sentry.interfaces.AppleCrashReport'):
            rv.append(preprocess_apple_crash_event)
        return rv

    def get_stacktrace_processors(self, data, stacktrace_infos,
                                  platforms, **kwargs):
        if 'cocoa' in platforms:
            return [NativeStacktraceProcessor]
