from __future__ import absolute_import

import logging
import posixpath

from symsynd import find_best_instruction, parse_addr, ImageLookup

from sentry import options
from django.db import transaction, IntegrityError
from sentry.models import VersionDSymFile, DSymPlatform, DSymApp
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import Symbolizer, SymbolicationFailed
from sentry.lang.native.utils import \
    get_sdk_from_event, cpu_name_from_data, \
    rebase_addr, version_build_from_data
from sentry.lang.native.systemsymbols import lookup_system_symbols
from sentry.utils import metrics
from sentry.stacktraces import StacktraceProcessor
from sentry.reprocessing import report_processing_issue

logger = logging.getLogger(__name__)

FRAME_CACHE_VERSION = 5


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
            self.image_lookup = ImageLookup(
                [img for img in self.debug_meta['images'] if img['type'] == 'apple']
            )
        else:
            self.available = False

    def close(self):
        StacktraceProcessor.close(self)
        if self.dsyms_referenced:
            metrics.incr(
                'dsyms.processed', amount=len(self.dsyms_referenced), instance=self.project.id
            )
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
            processable_frame['instruction_addr'], self.cpu_name, meta=meta
        )

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (platform == 'cocoa' and self.available and 'instruction_addr' in frame)

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
            processable_frame.set_cache_key_from_values(
                (
                    FRAME_CACHE_VERSION,
                    # Because the images can move around, we want to rebase
                    # the address for the cache key to be within the image
                    # the same way as we do it in the symbolizer.
                    rebase_addr(instr_addr, img),
                    img['uuid'].lower(),
                    img['cpu_type'],
                    img['cpu_subtype'],
                    img['image_size'],
                )
            )

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        referenced_images = set(
            pf.data['image_uuid'] for pf in processing_task.iter_processable_frames(self)
            if pf.cache_value is None and pf.data['image_uuid'] is not None
        )

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
                            version=app_info.version,
                            build=app_info.build,
                            defaults=dict(dsym_app=dsym_app),
                        )
                except IntegrityError:
                    # XXX: this can currently happen because we only
                    # support one app per dsym file.  Since this can
                    # happen in some cases anyways we ignore it.
                    pass

        self.sym = Symbolizer(
            self.project,
            self.image_lookup,
            cpu_name=self.cpu_name,
            referenced_images=referenced_images,
            on_dsym_file_referenced=on_referenced
        )

        if options.get('symbolserver.enabled'):
            self.fetch_system_symbols(processing_task)

    def fetch_system_symbols(self, processing_task):
        to_lookup = []
        pf_list = []
        for pf in processing_task.iter_processable_frames(self):
            img = pf.data['image']
            if pf.cache_value is not None or img is None or \
               self.sym.is_image_from_app_bundle(img):
                continue
            to_lookup.append(
                {
                    'object_uuid': img['uuid'],
                    'object_name': img['name'],
                    'addr': '0x%x' % rebase_addr(pf.data['instruction_addr'], img)
                }
            )
            pf_list.append(pf)

        if not to_lookup:
            return

        rv = lookup_system_symbols(to_lookup, self.sdk_info, self.sym.cpu_name)
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
            instruction_addr = processable_frame.data['instruction_addr']
            in_app = self.sym.is_in_app(instruction_addr, sdk_info=self.sdk_info)
            if in_app and raw_frame.get('function') is not None:
                in_app = not self.sym.is_internal_function(raw_frame['function'])
            if raw_frame.get('in_app') is None:
                raw_frame['in_app'] = in_app
            img_uuid = processable_frame.data['image_uuid']
            if img_uuid is not None:
                self.dsyms_referenced.add(img_uuid)
            try:
                symbolicated_frames = self.sym.symbolize_frame(
                    instruction_addr,
                    self.sdk_info,
                    symbolserver_match=processable_frame.data['symbolserver_match']
                )
                if not symbolicated_frames:
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
                    errors.append(
                        {
                            'type': e.type,
                            'image_uuid': e.image_uuid,
                            'image_path': e.image_path,
                            'image_arch': e.image_arch,
                            'message': e.message,
                        }
                    )
                else:
                    logger.debug('Failed to symbolicate with native backend', exc_info=True)
                return [raw_frame], [raw_frame], errors

            processable_frame.set_cache_value([in_app, symbolicated_frames])
        else:
            in_app, symbolicated_frames = processable_frame.cache_value
            raw_frame['in_app'] = in_app

        for sfrm in symbolicated_frames:
            new_frame = dict(frame)
            new_frame['function'] = sfrm['function']
            if sfrm.get('symbol'):
                new_frame['symbol'] = sfrm['symbol']
            new_frame['abs_path'] = sfrm['abs_path']
            new_frame['filename'] = sfrm.get('filename') or \
                (sfrm['abs_path'] and posixpath.basename(sfrm['abs_path'])) or None
            if sfrm.get('lineno'):
                new_frame['lineno'] = sfrm['lineno']
            if sfrm.get('colno'):
                new_frame['colno'] = sfrm['colno']
            if sfrm.get('package'):
                new_frame['package'] = sfrm['package']
            if new_frame.get('in_app') is None:
                new_frame['in_app'
                          ] = (in_app and not self.sym.is_internal_function(new_frame['function']))
            new_frames.append(new_frame)

        return new_frames, [raw_frame], []


class NativePlugin(Plugin2):
    can_disable = False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if 'cocoa' in platforms:
            return [NativeStacktraceProcessor]
