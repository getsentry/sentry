from __future__ import absolute_import

import logging
import six

from symbolic import FrameInfoMap, FrameTrust, ObjectLookup

from sentry.attachments import attachment_cache
from sentry.coreapi import cache_key_for_event
from sentry.lang.native.minidump import process_minidump, frames_from_minidump_thread, \
    MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.utils import parse_addr, rebase_addr
from sentry.models import Project, ProjectDebugFile
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import get_path


logger = logging.getLogger('sentry.minidumps')

# Frame trust values achieved through the use of CFI
CFI_TRUSTS = ('cfi', )

# Minimum frame trust value that we require to omit CFI reprocessing
MIN_TRUST = FrameTrust.fp

# Placeholder used to indicate that no CFI could be used to stackwalk a thread
NO_CFI_PLACEHOLDER = '__no_cfi__'


class ThreadRef(object):
    """Cacheable and mutable reference to stack frames of an event thread."""

    def __init__(self, frames, modules):
        self.raw_frames = frames
        self.modules = modules
        self.resolved_frames = None
        self._cache_key = self._get_cache_key()

    def _get_frame_key(self, frame):
        module = self.modules.find_object(frame['instruction_addr'])

        # If we cannot resolve a module for this frame, this means we're dealing
        # with an absolute address here. Since this address changes with every
        # crash and would poison our cache, we skip it for the key calculation.
        if not module:
            return None

        return (
            module.debug_id,
            rebase_addr(frame['instruction_addr'], module)
        )

    def _get_cache_key(self):
        values = [self._get_frame_key(f) for f in self.raw_frames]
        # XXX: The seed is hard coded for a future refactor
        return 'st:%s' % hash_values(values, seed='MinidumpCfiProcessor')

    def _frame_from_cache(self, entry):
        debug_id, offset, trust = entry[:3]
        module = self.modules.get_object(debug_id)

        # The debug_id can be None or refer to a missing module. If the module
        # was missing, the stored offset was absolute as well. Otherwise, we
        # have no choice but to assume an absolute address. In practice, the
        # latter hopefully never happens.
        addr = module.addr + parse_addr(offset) if module else parse_addr(offset)

        return module, {
            'instruction_addr': '0x%x' % addr,
            'package': module.code_file if module else None,
            'trust': trust,
        }

    def load_from_cache(self):
        """Attempts to load the reprocessed stack trace from the cache. The
        return value is ``True`` for a cache hit, and ``False`` for a miss.
        The loaded addresses are rebased to the provided code modules.
        """

        cached = cache.get(self._cache_key)
        if cached is None:
            return False

        if cached == NO_CFI_PLACEHOLDER:
            self.resolved_frames = NO_CFI_PLACEHOLDER
        else:
            self.resolved_frames = [self._frame_from_cache(c) for c in cached]

        return True

    def save_to_cache(self):
        """Stores the reprocessed stack trace to the cache. For frames with
        known code modules only relative offsets are stored, otherwise the
        absolute address as fallback."""
        if self.resolved_frames is None:
            raise RuntimeError('save_to_cache called before resolving frames')

        if self.resolved_frames == NO_CFI_PLACEHOLDER:
            cache.set(self._cache_key, NO_CFI_PLACEHOLDER)
            return

        values = []
        for module, frame in self.resolved_frames:
            module_id = module and module.debug_id
            addr = frame['instruction_addr']
            if module:
                addr = '0x%x' % rebase_addr(addr, module)
            values.append((module_id, addr, frame['trust']))

        cache.set(self._cache_key, values)

    def load_from_minidump(self, thread):
        """Loads the stack trace from a minidump process state thread."""

        # Convert the entire thread into frames conforming to the `Frame`
        # interface. Note that this is done with the same function as the
        # initial ingestion to avoid normalization conflicts.
        frames = frames_from_minidump_thread(thread)

        # Filter out stack traces that did not improve during reprocessing. For
        # these cases we only store a marker. This also prevents us from
        # destroying absolute addresses when restoring from the cache. Stack
        # traces containing CFI frames are mapped to their modules and stored.
        if any(frame['trust'] in CFI_TRUSTS for frame in frames):
            self.resolved_frames = [(self.modules.find_object(f['instruction_addr']), f)
                                    for f in frames]
        else:
            self.resolved_frames = NO_CFI_PLACEHOLDER

    def apply_to_event(self):
        """Writes the loaded stack trace back to the event's payload. Returns
        ``True`` if the payload was changed, otherwise ``False``."""
        if self.resolved_frames is None:
            raise RuntimeError('apply_to_event called before resolving frames')

        if self.resolved_frames == NO_CFI_PLACEHOLDER:
            return False

        self.raw_frames[:] = [frame for module, frame in self.resolved_frames]
        return True

    @property
    def needs_cfi(self):
        """Indicates whether this thread requires reprocessing with CFI due to
        scanned stack frames."""
        return any(
            getattr(FrameTrust, f.get('trust', ''), 0) < MIN_TRUST
            for f in self.raw_frames
        )


class ThreadProcessingHandle(object):
    """Helper object for processing all event threads.

    This class offers a view on all threads in the given event payload,
    including the crashing exception thread. Use ``iter_threads`` to iterate
    pointers to the original threads' stack traces. Likewise, ``iter_modules``
    returns references to all modules (images) loaded into the process.

    The handle keeps track of changes to the original data. To signal mutation,
    call ``indicate_change``. Finally, ``result`` returns the changed data or
    None if it was not changed.
    """

    def __init__(self, data):
        self.data = data
        self.modules = self._get_modules()
        self.changed = False

    def _get_modules(self):
        modules = get_path(self.data, 'debug_meta', 'images', filter=True)
        return ObjectLookup(modules or [])

    def iter_modules(self):
        """Returns an iterator over all code modules (images) loaded by the
        process at the time of the crash. The values are of type ``ObjectRef``.
        """
        return self.modules.iter_objects()

    def iter_threads(self):
        """Returns an iterator over all threads of the process at the time of
        the crash, including the crashing thread. The values are of type
        ``ThreadRef``."""
        for thread in get_path(self.data, 'threads', 'values', filter=True, default=()):
            if thread.get('crashed'):
                # XXX: Assumes that the full list of threads is present in the
                # original crash report. This is guaranteed by KSCrash and our
                # minidump utility.
                exceptions = get_path(self.data, 'exception', 'values', filter=True)
                frames = get_path(exceptions, 0, 'stacktrace', 'frames')
            else:
                frames = get_path(thread, 'stacktrace', 'frames')

            tid = thread.get('id')
            if tid and frames:
                yield tid, ThreadRef(frames, self.modules)

    def indicate_change(self):
        """Signals mutation of the data."""
        self.changed = True

    def result(self):
        """Returns ``data`` if ``indicate_change`` was called, otherwise None.
        """
        if self.changed:
            return self.data


def reprocess_minidump_with_cfi(data):
    """Reprocesses a minidump event if CFI(call frame information) is available
    and viable. The event is only processed if there are stack traces that
    contain scanned frames.
    """

    handle = ThreadProcessingHandle(data)

    # Check stacktrace caches first and skip all that do not need CFI. This is
    # either if a thread is trusted (i.e. it does not contain scanned frames) or
    # since it can be fetched from the cache.
    threads = {}
    for tid, thread in handle.iter_threads():
        if not thread.needs_cfi:
            continue

        if thread.load_from_cache():
            if thread.apply_to_event():
                handle.indicate_change()
            continue

        threads[tid] = thread

    if not threads:
        return handle.result()

    # Check if we have a minidump to reprocess
    cache_key = cache_key_for_event(data)
    attachments = attachment_cache.get(cache_key) or []
    minidump = next((a for a in attachments if a.type == MINIDUMP_ATTACHMENT_TYPE), None)
    if not minidump:
        return handle.result()

    # Determine modules loaded into the process during the crash
    debug_ids = [module.debug_id for module in handle.iter_modules()]
    if not debug_ids:
        return handle.result()

    # Load CFI caches for all loaded modules (even unreferenced ones)
    project = Project.objects.get_from_cache(id=data['project'])
    cficaches = ProjectDebugFile.difcache.get_cficaches(project, debug_ids)
    if not cficaches:
        return handle.result()

    # Reprocess the minidump with CFI
    cfi_map = FrameInfoMap.new()
    for debug_id, cficache in six.iteritems(cficaches):
        cfi_map.add(debug_id, cficache)
    state = process_minidump(minidump.data, cfi=cfi_map)

    # Merge existing stack traces with new ones from the minidump
    for minidump_thread in state.threads():
        thread = threads.get(minidump_thread.thread_id)
        if thread:
            thread.load_from_minidump(minidump_thread)
            thread.save_to_cache()
            if thread.apply_to_event():
                handle.indicate_change()

    return handle.result()
