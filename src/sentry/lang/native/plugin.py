from __future__ import absolute_import

import uuid
import logging
import posixpath

from symbolic import parse_addr, find_best_instruction, arch_get_ip_reg_name, \
    ObjectLookup

from sentry import options
from sentry.plugins import Plugin2
from sentry.lang.native.cfi import reprocess_minidump_with_cfi
from sentry.lang.native.minidump import is_minidump_event
from sentry.lang.native.symbolizer import Symbolizer, SymbolicationFailed
from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data, \
    rebase_addr
from sentry.lang.native.systemsymbols import lookup_system_symbols
from sentry.utils import metrics
from sentry.utils.safe import get_path
from sentry.stacktraces import StacktraceProcessor
from sentry.reprocessing import report_processing_issue

logger = logging.getLogger(__name__)

FRAME_CACHE_VERSION = 6


class NativeStacktraceProcessor(StacktraceProcessor):
    supported_platforms = ('cocoa', 'native')
    supported_images = ('apple', 'symbolic')

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.arch = cpu_name_from_data(self.data)
        self.sym = None
        self.difs_referenced = set()

        images = get_path(self.data, 'debug_meta', 'images', default=(),
                          filter=(lambda img: img and img.get('type') in self.supported_images))

        if images:
            self.available = True
            self.sdk_info = get_sdk_from_event(self.data)
            self.object_lookup = ObjectLookup(images)
        else:
            self.available = False

    def close(self):
        StacktraceProcessor.close(self)
        if self.difs_referenced:
            metrics.incr(
                'dsyms.processed',
                amount=len(self.difs_referenced),
                skip_internal=True,
                tags={
                    'project_id': self.project.id,
                },
            )

    def find_best_instruction(self, processable_frame):
        """Given a frame, stacktrace info and frame index this returns the
        interpolated instruction address we then use for symbolication later.
        """
        if self.arch is None:
            return parse_addr(processable_frame['instruction_addr'])

        crashing_frame = False
        signal = None
        ip_reg = None

        # We only need to provide meta information for frame zero
        if processable_frame.idx == 0:
            # The signal is useful information for symbolic in some situations
            # to disambiugate the first frame.  If we can get this information
            # from the mechanism we want to pass it onwards.
            exceptions = get_path(self.data, 'exception', 'values', filter=True)
            signal = get_path(exceptions, 0, 'mechanism', 'meta', 'signal', 'number')
            if signal is not None:
                signal = int(signal)

            registers = processable_frame.stacktrace_info.stacktrace.get('registers')
            if registers:
                ip_reg_name = arch_get_ip_reg_name(self.arch)
                if ip_reg_name:
                    ip_reg = registers.get(ip_reg_name)
            crashing_frame = True

        return find_best_instruction(
            processable_frame['instruction_addr'],
            arch=self.arch,
            crashing_frame=crashing_frame,
            signal=signal,
            ip_reg=ip_reg
        )

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (platform in self.supported_platforms and self.available
                and 'instruction_addr' in frame)

    def preprocess_frame(self, processable_frame):
        instr_addr = self.find_best_instruction(processable_frame)
        obj = self.object_lookup.find_object(instr_addr)

        processable_frame.data = {
            'instruction_addr': instr_addr,
            'obj': obj,
            'debug_id': obj.id if obj is not None else None,
            'symbolserver_match': None,
        }

        if obj is not None:
            processable_frame.set_cache_key_from_values(
                (
                    FRAME_CACHE_VERSION,
                    # Because the images can move around, we want to rebase
                    # the address for the cache key to be within the image
                    # the same way as we do it in the symbolizer.
                    rebase_addr(instr_addr, obj),
                    obj.id,
                    obj.arch,
                    obj.size,
                )
            )

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        referenced_images = set(
            pf.data['debug_id'] for pf in processing_task.iter_processable_frames(self)
            if pf.cache_value is None and pf.data['debug_id'] is not None
        )

        self.sym = Symbolizer(
            self.project,
            self.object_lookup,
            referenced_images=referenced_images,
        )

        if options.get('symbolserver.enabled'):
            self.fetch_system_symbols(processing_task)

    def fetch_system_symbols(self, processing_task):
        to_lookup = []
        pf_list = []
        for pf in processing_task.iter_processable_frames(self):
            obj = pf.data['obj']
            if pf.cache_value is not None or obj is None or \
               self.sym.is_image_from_app_bundle(obj):
                continue

            # We can only look up objects in the symbol server that have a
            # uuid.  If we encounter things with an age appended or
            # similar we need to skip.
            try:
                uuid.UUID(obj.id)
            except (ValueError, TypeError):
                continue

            to_lookup.append(
                {
                    'object_uuid': obj.id,
                    'object_name': obj.name or '<unknown>',
                    'addr': '0x%x' % rebase_addr(pf.data['instruction_addr'], obj)
                }
            )
            pf_list.append(pf)

        if not to_lookup:
            return

        rv = lookup_system_symbols(to_lookup, self.sdk_info, self.arch)
        if rv is not None:
            for symrv, pf in zip(rv, pf_list):
                if symrv is None:
                    continue
                pf.data['symbolserver_match'] = symrv

    def process_frame(self, processable_frame, processing_task):
        frame = processable_frame.frame
        raw_frame = dict(frame)
        errors = []

        if processable_frame.cache_value is None:
            # Construct a raw frame that is used by the symbolizer
            # backend.  We only assemble the bare minimum we need here.
            instruction_addr = processable_frame.data['instruction_addr']
            in_app = self.sym.is_in_app(
                instruction_addr,
                sdk_info=self.sdk_info
            )

            if in_app and raw_frame.get('function') is not None:
                in_app = not self.sym.is_internal_function(
                    raw_frame['function'])

            if raw_frame.get('in_app') is None:
                raw_frame['in_app'] = in_app

            debug_id = processable_frame.data['debug_id']
            if debug_id is not None:
                self.difs_referenced.add(debug_id)

            try:
                symbolicated_frames = self.sym.symbolize_frame(
                    instruction_addr,
                    self.sdk_info,
                    symbolserver_match=processable_frame.data['symbolserver_match'],
                    trust=raw_frame.get('trust'),
                )
                if not symbolicated_frames:
                    if raw_frame.get('trust') == 'scan':
                        return [], [raw_frame], []
                    else:
                        return None, [raw_frame], []
            except SymbolicationFailed as e:
                # User fixable but fatal errors are reported as processing
                # issues
                if e.is_user_fixable and e.is_fatal:
                    report_processing_issue(
                        self.data,
                        scope='native',
                        object='dsym:%s' % e.image_uuid,
                        type=e.type,
                        data=e.get_data()
                    )

                # This in many ways currently does not really do anything.
                # The reason is that once a processing issue is reported
                # the event will only be stored as a raw event and no
                # group will be generated.  As a result it also means that
                # we will not have any user facing event or error showing
                # up at all.  We want to keep this here though in case we
                # do not want to report some processing issues (eg:
                # optional difs)
                errors = []
                if e.is_user_fixable or e.is_sdk_failure:
                    errors.append(e.get_data())
                else:
                    logger.debug('Failed to symbolicate with native backend',
                                 exc_info=True)

                return [raw_frame], [raw_frame], errors

            processable_frame.set_cache_value([in_app, symbolicated_frames])

        else:  # processable_frame.cache_value is present
            in_app, symbolicated_frames = processable_frame.cache_value
            raw_frame['in_app'] = in_app

        new_frames = []
        for sfrm in symbolicated_frames:
            new_frame = dict(frame)
            new_frame['function'] = sfrm['function']
            if sfrm.get('symbol'):
                new_frame['symbol'] = sfrm['symbol']
            new_frame['abs_path'] = sfrm['abs_path']
            new_frame['filename'] = sfrm.get('filename') or \
                (sfrm['abs_path'] and posixpath.basename(sfrm['abs_path'])) or \
                None
            if sfrm.get('lineno'):
                new_frame['lineno'] = sfrm['lineno']
            if sfrm.get('colno'):
                new_frame['colno'] = sfrm['colno']
            if sfrm.get('package') or processable_frame.data['obj'] is not None:
                new_frame['package'] = sfrm.get(
                    'package', processable_frame.data['obj'].name)
            if new_frame.get('in_app') is None:
                new_frame['in_app'] = in_app and \
                    not self.sym.is_internal_function(new_frame['function'])
            new_frames.append(new_frame)

        return new_frames, [raw_frame], []


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_enhancers(self, data):
        if is_minidump_event(data):
            return [reprocess_minidump_with_cfi]

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if any(platform in NativeStacktraceProcessor.supported_platforms for platform in platforms):
            return [NativeStacktraceProcessor]
