from __future__ import absolute_import

import logging
import six

from symbolic import FrameInfoMap, FrameTrust, ObjectLookup

from sentry.attachments import attachment_cache
from sentry.lang.native.minidump import process_minidump, frames_from_minidump_thread, \
    MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.utils import rebase_addr
from sentry.models import Project, ProjectDebugFile
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values


logger = logging.getLogger(__name__)

# Frame trust values achieved through the use of CFI
CFI_TRUSTS = ('cfi', 'cfi-scan')

# Minimum frame trust value that we require to omit CFI reprocessing
MIN_TRUST = FrameTrust.fp

# Placeholder used to indicate that no CFI could be used to stackwalk a thread
NO_CFI_PLACEHOLDER = '__no_cfi__'


def is_trusted_thread(thread):
    return all(
        getattr(FrameTrust, f.get('trust', ''), 0) >= MIN_TRUST
        for f in thread.iter_frames()
    )


class ThreadRef(object):
    def __init__(self, frames, modules):
        self.raw_frames = frames
        self.modules = modules
        self.resolved_frames = None
        self.cache_key = self._get_cache_key()

    def _get_frame_key(self, frame):
        module = self.modules.find_object(frame['instruction_addr'])

        # If we cannot resolve a module for this frame, this means we're dealing
        # with an absolute address here. Since this address changes with every
        # crash and would poison our cache, we skip it.
        if not module:
            return None

        return (
            module.id,
            rebase_addr(frame['instruction_addr'], module)
        )

    def _get_cache_key(self):
        values = [self._get_frame_key(f) for f in self.raw_frames]
        return 'st:%s' % hash_values(values, seed='MinidumpCfiProcessor')

    def _frame_from_cache(self, entry):
        debug_id, offset, trust = entry[:3]
        module = self.modules.get_object(debug_id)
        addr = module.addr + offset if module else offset

        return module, {
            'instruction_addr': '0x%x' % addr,
            'function': '<unknown>',  # Required by interface
            'module': module.name if module else None,
            'trust': trust,
        }

    def load_from_cache(self):
        cached = cache.get(self.cache_key)
        if cached is None:
            return False

        if cached != NO_CFI_PLACEHOLDER:
            self.resolved_frames = NO_CFI_PLACEHOLDER
        else:
            self.resolved_frames = [self._frame_from_cache(c) for c in cached]

        return True

    def save_to_cache(self):
        if self.resolved_frames is None:
            raise RuntimeError('save_to_cache called before resolving frames')

        if self.resolved_frames == NO_CFI_PLACEHOLDER:
            cache.set(self.cache_key, NO_CFI_PLACEHOLDER)
            return

        values = []
        for module, frame in self.resolved_frames:
            module_id = module and module.id
            addr = frame['instruction_addr']
            if module:
                addr = '0x%x' % rebase_addr(addr, module)
            values.append((module_id, addr, frame['trust']))

        cache.set(self.cache_key, values)

    def update_from_minidump(self, thread):
        frames = frames_from_minidump_thread(thread)
        if any(frame['trust'] in CFI_TRUSTS for frame in frames):
            self.resolved_frames = [
                (self.modules.find_object(frame['instruction_addr']), frame)
                for frame in frames
            ]
        else:
            self.resolved_frames = NO_CFI_PLACEHOLDER

    def apply_to_event(self):
        if self.resolved_frames is None:
            raise RuntimeError('apply_to_event called before resolving frames')

        if self.resolved_frames == NO_CFI_PLACEHOLDER:
            return False

        self.raw_frames[:] = [frame for module, frame in self.resolved_frames]
        return True

    def iter_frames(self):
        return iter(self.raw_frames)


class ThreadProcessingHandle(object):
    def __init__(self, data):
        self.data = data
        self.modules = self._get_modules()
        self.changed = False

    def _get_modules(self):
        modules = self.data.get('debug_meta', {}).get('images', [])
        return ObjectLookup(modules)

    def iter_modules(self):
        return self.modules.iter_objects()

    def iter_threads(self):
        exceptions = self.data.get('exception', {}).get('values', [])
        exception = exceptions[0] if exceptions else {}

        for thread in self.data.get('threads', {}).get('values', []):
            if thread.get('crashed'):
                frames = exception.get('stacktrace', {}).get('frames')
            else:
                frames = thread.get('stacktrace', {}).get('frames')

            tid = thread.get('id')
            if tid and frames:
                yield tid, ThreadRef(frames, self.modules)

    def indicate_change(self):
        self.changed = True

    def result(self):
        if self.changed:
            return self.data


def reprocess_minidump_with_cfi(data):
    handle = ThreadProcessingHandle(data)

    # Check stacktrace caches first and skip all that do not need CFI
    threads = {}
    for tid, thread in handle.iter_threads():
        if is_trusted_thread(thread):
            continue

        if thread.load_from_cache():
            if thread.apply_to_event():
                handle.indicate_change()
            continue

        threads[tid] = thread

    if not threads:
        return handle.result()

    # Check if we have a minidump to reprocess
    # XXX: Copied from coreapi.py since we don't have access to the cache_key here
    cache_key = u'e:{1}:{0}'.format(data['project'], data['event_id'])
    attachments = attachment_cache.get(cache_key) or []
    minidump = next((a for a in attachments if a.type == MINIDUMP_ATTACHMENT_TYPE), None)
    if not minidump:
        return handle.result()

    # Determine modules loaded into the process during the crash
    debug_ids = [module.id for module in handle.iter_modules()]
    if not debug_ids:
        return handle.result()

    # Load CFI caches for all loaded modules (even unreferenced ones)
    project = Project.objects.get_from_cache(id=data['project'])
    cficaches = ProjectDebugFile.difcache.get_cficaches(project, debug_ids)
    if not cficaches:
        return handle.result()

    # Put all caches into a frame info map for stackwalking
    cfi_map = FrameInfoMap.new()
    for debug_id, cficache in six.iteritems(cficaches):
        cfi_map.add(debug_id, cficache)

    # Reprocess the minidump with CFI and merge stacktraces
    state = process_minidump(minidump.data, cfi=cfi_map)
    for minidump_thread in state.threads():
        thread = threads.get(minidump_thread.thread_id)
        if thread:
            thread.update_from_minidump(minidump_thread)
            thread.save_to_cache()
            if thread.apply_to_event():
                handle.indicate_change()

    return handle.result()
