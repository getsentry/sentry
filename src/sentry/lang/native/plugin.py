from __future__ import absolute_import

import uuid
import logging

from symbolic import LineInfo, parse_addr, find_best_instruction, arch_get_ip_reg_name, \
    ObjectLookup
from symbolic.utils import make_buffered_slice_reader

from sentry import options
from sentry.plugins import Plugin2
from sentry.lang.native.error import write_error
from sentry.lang.native.minidump import get_attached_minidump, is_minidump_event, merge_symbolicator_minidump_response
from sentry.lang.native.symbolicator import Symbolicator, merge_symbolicator_image, handle_symbolicator_response_status
from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data, \
    merge_symbolicated_frame, native_images_from_data, rebase_addr, signal_from_data, \
    is_native_platform, is_native_event
from sentry.lang.native.systemsymbols import lookup_system_symbols
from sentry.models import Project
from sentry.utils.in_app import is_known_third_party
from sentry.utils.safe import get_path, trim
from sentry.stacktraces.processing import StacktraceProcessor, find_stacktraces_in_data

logger = logging.getLogger(__name__)

FRAME_CACHE_VERSION = 6

SYMBOLICATOR_FRAME_ATTRS = ("instruction_addr", "package", "lang", "symbol",
                            "function", "symbol_addr", "filename", "lineno",
                            "line_addr")


def task_id_cache_key_for_event(data):
    return u'symbolicator:{1}:{0}'.format(data['project'], data['event_id'])


class NativeStacktraceProcessor(StacktraceProcessor):
    supported_platforms = ('cocoa', 'native')
    # TODO(ja): Clean up all uses of image type "apple", "uuid", "id" and "name"
    supported_images = ('apple', 'symbolic', 'elf', 'macho', 'pe')

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.arch = cpu_name_from_data(self.data)
        self.signal = signal_from_data(self.data)

        self.sym = None

        images = get_path(self.data, 'debug_meta', 'images', default=(),
                          filter=self._is_valid_image)

        if images:
            self.available = True
            self.sdk_info = get_sdk_from_event(self.data)
            self.object_lookup = ObjectLookup(images)
            self.images = images
        else:
            self.available = False

    def _is_valid_image(self, image):
        # TODO(ja): Deprecate this. The symbolicator should take care of
        # filtering valid images.
        return bool(image) \
            and image.get('type') in self.supported_images \
            and image.get('image_addr') is not None \
            and image.get('image_size') is not None \
            and (image.get('debug_id') or image.get('id') or image.get('uuid')) is not None

    def close(self):
        StacktraceProcessor.close(self)

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
            signal = self.signal

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
        # XXX(markus): We cannot return false for any native frame here.
        # Stacktrace processors have a (hard to fix) bug where all
        # non-processable frames of a processable stacktrace are removed from
        # an event.
        #
        # Before introducing Symbolicator (and calling it from enhancers) this
        # never used to be a problem because even for mixed-platform
        # stacktraces there was always at least one processor returning
        # handles_frame() = True for each frame, so in the end no frame was
        # discarded.

        platform = frame.get('platform') or self.data.get('platform')
        if platform not in self.supported_platforms:
            return False

        if 'instruction_addr' not in frame:
            return False

        return True

    def preprocess_frame(self, processable_frame):
        instr_addr = self.find_best_instruction(processable_frame)
        obj = self.object_lookup.find_object(instr_addr)

        processable_frame.data = {
            'instruction_addr': instr_addr,
            'obj': obj,
            'debug_id': obj.debug_id if obj is not None else None,
            'symbolserver_match': None,
        }

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        if options.get('symbolserver.enabled'):
            self.fetch_ios_system_symbols(processing_task)

    def fetch_ios_system_symbols(self, processing_task):
        to_lookup = []
        pf_list = []
        for pf in processing_task.iter_processable_frames(self):
            if pf.cache_value is not None:
                continue

            if pf.get('data', {}).get('symbolicator_status') == 'symbolicated':
                continue

            obj = pf.data['obj']
            package = obj and obj.code_file
            # TODO(ja): This should check for iOS specifically.  Also
            # check in symbolicator.py for handle_symbolicator_status
            if not package or not is_known_third_party(package):
                continue

            # We can only look up objects in the symbol server that have a
            # uuid.  If we encounter things with an age appended or
            # similar we need to skip.
            try:
                uuid.UUID(obj.debug_id)
            except (ValueError, TypeError):
                continue

            to_lookup.append(
                {
                    'object_uuid': obj.debug_id,
                    'object_name': obj.code_file or '<unknown>',
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

        # Ensure that package is set in the raw frame, mapped from the
        # debug_images array in the payload. Grouping and UI can use this path
        # to infer in_app and exclude frames from grouping.
        if raw_frame.get('package') is None:
            obj = processable_frame.data['obj']
            raw_frame['package'] = obj and obj.code_file or None

        symbolicated_frames = convert_ios_symbolserver_match(
            processable_frame.data['instruction_addr'],
            processable_frame.data['symbolserver_match']
        )

        if not symbolicated_frames:
            if raw_frame.get('trust') == 'scan':
                return [], [raw_frame], []
            else:
                return None, [raw_frame], []

        new_frames = []
        for sfrm in symbolicated_frames:
            new_frame = dict(raw_frame)
            merge_symbolicated_frame(new_frame, sfrm)
            new_frames.append(new_frame)

        return new_frames, [raw_frame], []


def reprocess_minidump(data):
    project = Project.objects.get_from_cache(id=data['project'])

    minidump = get_attached_minidump(data)

    if not minidump:
        logger.error("Missing minidump for minidump event")
        return

    task_id_cache_key = task_id_cache_key_for_event(data)

    symbolicator = Symbolicator(
        project=project,
        task_id_cache_key=task_id_cache_key
    )

    response = symbolicator.process_minidump(make_buffered_slice_reader(minidump.data, None))

    if handle_symbolicator_response_status(data, response):
        merge_symbolicator_minidump_response(data, response)

    return data


def _handles_frame(data, frame):
    if not frame:
        return False

    if get_path(frame, 'data', 'symbolicator_status') is not None:
        return False

    # TODO: Consider ignoring platform
    platform = frame.get('platform') or data.get('platform')
    return is_native_platform(platform) and 'instruction_addr' in frame


def process_payload(data):
    project = Project.objects.get_from_cache(id=data['project'])
    task_id_cache_key = task_id_cache_key_for_event(data)

    symbolicator = Symbolicator(
        project=project,
        task_id_cache_key=task_id_cache_key
    )

    stacktrace_infos = [
        stacktrace
        for stacktrace in find_stacktraces_in_data(data)
        if any(is_native_platform(x) for x in stacktrace.platforms)
    ]

    stacktraces = [
        {
            'registers': sinfo.stacktrace.get('registers') or {},
            'frames': [
                f for f in reversed(sinfo.stacktrace.get('frames') or ())
                if _handles_frame(data, f)
            ]
        }
        for sinfo in stacktrace_infos
    ]

    if not any(stacktrace['frames'] for stacktrace in stacktraces):
        return

    modules = native_images_from_data(data)

    response = symbolicator.process_payload(stacktraces=stacktraces, modules=modules)

    assert len(modules) == len(response['modules']), (modules, response)

    sdk_info = get_sdk_from_event(data)

    for raw_image, complete_image in zip(modules, response['modules']):
        merge_symbolicator_image(
            raw_image,
            complete_image,
            sdk_info,
            lambda e: write_error(
                e,
                data))

    assert len(stacktraces) == len(response['stacktraces']), (stacktraces, response)

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response['stacktraces']):
        complete_frames_by_idx = {}
        for complete_frame in complete_stacktrace.get('frames') or ():
            complete_frames_by_idx \
                .setdefault(complete_frame['original_index'], []) \
                .append(complete_frame)

        new_frames = []
        native_frames_idx = 0

        for raw_frame in reversed(sinfo.stacktrace['frames']):
            if not _handles_frame(data, raw_frame):
                new_frames.append(raw_frame)
                continue

            for complete_frame in complete_frames_by_idx.get(native_frames_idx) or ():
                merged_frame = dict(raw_frame)
                merge_symbolicated_frame(merged_frame, complete_frame)
                if merged_frame.get('package'):
                    raw_frame['package'] = merged_frame['package']
                new_frames.append(merged_frame)

            native_frames_idx += 1

        if sinfo.container is not None and native_frames_idx > 0:
            sinfo.container['raw_stacktrace'] = {
                'frames': list(sinfo.stacktrace['frames']),
                'registers': sinfo.stacktrace.get('registers')
            }

        new_frames.reverse()
        sinfo.stacktrace['frames'] = new_frames

    return data


def convert_ios_symbolserver_match(instruction_addr, symbolserver_match):
    if not symbolserver_match:
        return []

    symbol = symbolserver_match['symbol']
    if symbol[:1] == '_':
        symbol = symbol[1:]

    # We still use this construct from symbolic for demangling (at least)
    line_info = LineInfo(
        sym_addr=parse_addr(symbolserver_match['addr']),
        instr_addr=parse_addr(instruction_addr),
        line=None,
        lang=None,
        symbol=symbol
    )

    function = line_info.function_name
    package = symbolserver_match['object_name']

    return [{
        'sym_addr': '0x%x' % (line_info.sym_addr,),
        'instruction_addr': '0x%x' % (line_info.instr_addr,),
        'function': function,
        'symbol': symbol if function != symbol else None,
        'filename': trim(line_info.rel_path, 256),
        'abs_path': trim(line_info.abs_path, 256),
        'package': package,
    }]


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_enhancers(self, data):
        rv = []

        if is_minidump_event(data):
            rv.append(reprocess_minidump)
        if is_native_event(data):
            rv.append(process_payload)

        return rv

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if any(platform in NativeStacktraceProcessor.supported_platforms for platform in platforms):
            return [NativeStacktraceProcessor]
