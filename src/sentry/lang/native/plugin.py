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
from sentry.lang.native.symbolicator import run_symbolicator
from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data, \
    rebase_addr, signal_from_data, image_name
from sentry.lang.native.systemsymbols import lookup_system_symbols
from sentry.models.eventerror import EventError
from sentry.utils import metrics
from sentry.utils.safe import get_path
from sentry.stacktraces import StacktraceProcessor
from sentry.reprocessing import report_processing_issue

logger = logging.getLogger(__name__)

FRAME_CACHE_VERSION = 6

SYMBOLICATOR_FRAME_ATTRS = ("instruction_addr", "package", "lang", "symbol",
                            "function", "symbol_addr", "filename", "lineno",
                            "line_addr")


def _is_symbolicator_enabled(project):
    return options.get('symbolicator.enabled') and \
        project.get_option('sentry:symbolicator-enabled')


def request_id_cache_key_for_event(data):
    return u'symbolicator:{1}:{0}'.format(data['project'], data['event_id'])


class NativeStacktraceProcessor(StacktraceProcessor):
    supported_platforms = ('cocoa', 'native')
    # TODO(ja): Clean up all uses of image type "apple", "uuid", "id" and "name"
    supported_images = ('apple', 'symbolic', 'elf', 'macho', 'pe')

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        # If true, the project has been opted into using the symbolicator
        # service for native symbolication, which also means symbolic is not
        # used at all anymore.
        # The (iOS) symbolserver is still used regardless of this value.
        self.use_symbolicator = _is_symbolicator_enabled(self.project)

        self.arch = cpu_name_from_data(self.data)
        self.signal = signal_from_data(self.data)

        self.sym = None
        self.difs_referenced = set()

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
        platform = frame.get('platform') or self.data.get('platform')
        return (platform in self.supported_platforms and self.available
                and 'instruction_addr' in frame)

    def preprocess_frame(self, processable_frame):
        instr_addr = self.find_best_instruction(processable_frame)
        obj = self.object_lookup.find_object(instr_addr)

        processable_frame.data = {
            'instruction_addr': instr_addr,
            'obj': obj,
            'debug_id': obj.debug_id if obj is not None else None,
            'symbolserver_match': None,

            # `[]` is used to indicate to the symbolizer that the symbolicator
            # deliberately discarded this frame, while `None` means the
            # symbolicator didn't run (because `self.use_symbolicator` is
            # false).
            # If the symbolicator did run and was not able to symbolize the
            # frame, this value will be a list with the raw frame as only item.
            'symbolicator_match': [] if self.use_symbolicator else None,
        }

        if obj is not None:
            processable_frame.set_cache_key_from_values(
                (
                    FRAME_CACHE_VERSION,
                    # Because the images can move around, we want to rebase
                    # the address for the cache key to be within the image
                    # the same way as we do it in the symbolizer.
                    rebase_addr(instr_addr, obj),
                    obj.debug_id,
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

        if self.use_symbolicator:
            self.run_symbolicator(processing_task)

    def run_symbolicator(self, processing_task):
        # TODO(markus): Make this work with minidumps. An unprocessed minidump
        # event will not contain unsymbolicated frames, because the minidump
        # upload already happened in store.
        # It will also presumably not contain images, so `self.available` will
        # already be `False`.

        if not self.available:
            return

        request_id_cache_key = request_id_cache_key_for_event(self.data)

        stacktraces = []
        processable_stacktraces = []
        for stacktrace_info, pf_list in processing_task.iter_processable_stacktraces():
            registers = stacktrace_info.stacktrace.get('registers') or {}

            # The filtering condition of this list comprehension is copied
            # from `iter_processable_frames`.
            #
            # We cannot reuse `iter_processable_frames` because the
            # symbolicator currently expects a list of stacktraces, not
            # flat frames.
            #
            # Right now we can't even filter out frames (e.g. using a frame
            # cache locally). The stacktraces have to be as complete as
            # possible because the symbolicator assumes the first frame of
            # a stacktrace to be the crashing frame. This assumption is
            # already violated because the SDK might chop off frames though
            # (which is less likely to be the case though).
            pf_list = [
                pf for pf in reversed(pf_list)
                if pf.processor == self
            ]

            frames = []

            for pf in pf_list:
                frame = {'instruction_addr': pf['instruction_addr']}
                if pf.get('trust') is not None:
                    frame['trust'] = pf['trust']
                frames.append(frame)

            stacktraces.append({
                'registers': registers,
                'frames': frames
            })

            processable_stacktraces.append(pf_list)

        rv = run_symbolicator(stacktraces=stacktraces, modules=self.images,
                              project=self.project, arch=self.arch,
                              signal=self.signal,
                              request_id_cache_key=request_id_cache_key)
        if not rv:
            self.data \
                .setdefault('errors', []) \
                .extend(self._handle_symbolication_failed(
                    SymbolicationFailed(type=EventError.NATIVE_SYMBOLICATOR_FAILED)
                ))
            return

        # TODO(markus): Set signal and os context from symbolicator response,
        # for minidumps

        assert len(self.images) == len(rv['modules']), (self.images, rv)

        for image, fetched_debug_file in zip(self.images, rv['modules']):
            status = fetched_debug_file.pop('status')
            # Set image data from symbolicator as symbolicator might know more
            # than the SDK, especially for minidumps
            image.update(fetched_debug_file)

            if status in ('found', 'unused'):
                continue
            elif status == 'missing_debug_file':
                error = SymbolicationFailed(type=EventError.NATIVE_MISSING_DSYM)
            elif status == 'malformed_debug_file':
                error = SymbolicationFailed(type=EventError.NATIVE_BAD_DSYM)
            elif status == 'too_large':
                error = SymbolicationFailed(type=EventError.FETCH_TOO_LARGE)
            elif status == 'fetching_failed':
                error = SymbolicationFailed(type=EventError.FETCH_GENERIC_ERROR)
            elif status == 'other':
                error = SymbolicationFailed(type=EventError.UNKNOWN_ERROR)
            else:
                logger.error("Unknown status: %s", status)
                continue

            error.image_arch = image['arch']
            error.image_path = image['code_file']
            error.image_name = image_name(image['code_file'])
            error.image_uuid = image['debug_id']
            self.data.setdefault('errors', []) \
                .extend(self._handle_symbolication_failed(error))

        assert len(stacktraces) == len(rv['stacktraces'])

        for pf_list, symbolicated_stacktrace in zip(
            processable_stacktraces,
            rv['stacktraces']
        ):
            for symbolicated_frame in symbolicated_stacktrace.get('frames') or ():
                pf = pf_list[symbolicated_frame['original_index']]
                pf.data['symbolicator_match'].append(symbolicated_frame)

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
                uuid.UUID(obj.debug_id)
            except (ValueError, TypeError):
                continue

            to_lookup.append(
                {
                    'object_uuid': obj.debug_id,
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

    def _handle_symbolication_failed(self, e):
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

        return errors

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
                    symbolicator_match=processable_frame.data.get('symbolicator_match'),
                    trust=raw_frame.get('trust'),
                )
                if not symbolicated_frames:
                    if raw_frame.get('trust') == 'scan':
                        return [], [raw_frame], []
                    else:
                        return None, [raw_frame], []
            except SymbolicationFailed as e:
                errors = self._handle_symbolication_failed(e)
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
