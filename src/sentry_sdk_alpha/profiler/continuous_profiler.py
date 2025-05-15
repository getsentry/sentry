import atexit
import os
import random
import sys
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone

from sentry_sdk_alpha.consts import VERSION
from sentry_sdk_alpha.envelope import Envelope
from sentry_sdk_alpha._lru_cache import LRUCache
from sentry_sdk_alpha.profiler.utils import (
    DEFAULT_SAMPLING_FREQUENCY,
    extract_stack,
)
from sentry_sdk_alpha.utils import (
    capture_internal_exception,
    is_gevent,
    logger,
    now,
    set_in_app_in_frames,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from typing import Callable
    from typing import Deque
    from typing import Dict
    from typing import List
    from typing import Optional
    from typing import Set
    from typing import Type
    from typing import Union
    from typing_extensions import TypedDict
    from sentry_sdk_alpha._types import ContinuousProfilerMode, SDKInfo
    from sentry_sdk_alpha.profiler.utils import (
        ExtractedSample,
        FrameId,
        StackId,
        ThreadId,
        ProcessedFrame,
        ProcessedStack,
    )

    ProcessedSample = TypedDict(
        "ProcessedSample",
        {
            "timestamp": float,
            "thread_id": ThreadId,
            "stack_id": int,
        },
    )


try:
    from gevent.monkey import get_original
    from gevent.threadpool import ThreadPool as _ThreadPool

    ThreadPool = _ThreadPool  # type: Optional[Type[_ThreadPool]]
    thread_sleep = get_original("time", "sleep")
except ImportError:
    thread_sleep = time.sleep
    ThreadPool = None


_scheduler = None  # type: Optional[ContinuousScheduler]


def setup_continuous_profiler(options, sdk_info, capture_func):
    # type: (Dict[str, Any], SDKInfo, Callable[[Envelope], None]) -> bool
    global _scheduler

    if _scheduler is not None:
        logger.debug("[Profiling] Continuous Profiler is already setup")
        return False

    if is_gevent():
        # If gevent has patched the threading modules then we cannot rely on
        # them to spawn a native thread for sampling.
        # Instead we default to the GeventContinuousScheduler which is capable of
        # spawning native threads within gevent.
        default_profiler_mode = GeventContinuousScheduler.mode
    else:
        default_profiler_mode = ThreadContinuousScheduler.mode

    profiler_mode = default_profiler_mode
    if options.get("profiler_mode") is not None:
        profiler_mode = options["profiler_mode"]

    frequency = DEFAULT_SAMPLING_FREQUENCY

    if profiler_mode == ThreadContinuousScheduler.mode:
        _scheduler = ThreadContinuousScheduler(
            frequency, options, sdk_info, capture_func
        )
    elif profiler_mode == GeventContinuousScheduler.mode:
        _scheduler = GeventContinuousScheduler(
            frequency, options, sdk_info, capture_func
        )
    else:
        raise ValueError("Unknown continuous profiler mode: {}".format(profiler_mode))

    logger.debug(
        "[Profiling] Setting up continuous profiler in {mode} mode".format(
            mode=_scheduler.mode
        )
    )

    atexit.register(teardown_continuous_profiler)

    return True


def try_autostart_continuous_profiler():
    # type: () -> None

    # TODO: deprecate this as it'll be replaced by the auto lifecycle option

    if _scheduler is None:
        return

    if not _scheduler.is_auto_start_enabled():
        return

    _scheduler.manual_start()


def try_profile_lifecycle_trace_start():
    # type: () -> Union[ContinuousProfile, None]
    if _scheduler is None:
        return None

    return _scheduler.auto_start()


def start_profiler():
    # type: () -> None
    if _scheduler is None:
        return

    _scheduler.manual_start()


def stop_profiler():
    # type: () -> None
    if _scheduler is None:
        return

    _scheduler.manual_stop()


def teardown_continuous_profiler():
    # type: () -> None
    stop_profiler()

    global _scheduler
    _scheduler = None


def get_profiler_id():
    # type: () -> Union[str, None]
    if _scheduler is None:
        return None
    return _scheduler.profiler_id


def determine_profile_session_sampling_decision(sample_rate):
    # type: (Union[float, None]) -> bool

    # `None` is treated as `0.0`
    if not sample_rate:
        return False

    return random.random() < float(sample_rate)


class ContinuousProfile:
    active: bool = True

    def stop(self):
        # type: () -> None
        self.active = False


class ContinuousScheduler:
    mode = "unknown"  # type: ContinuousProfilerMode

    def __init__(self, frequency, options, sdk_info, capture_func):
        # type: (int, Dict[str, Any], SDKInfo, Callable[[Envelope], None]) -> None
        self.interval = 1.0 / frequency
        self.options = options
        self.sdk_info = sdk_info
        self.capture_func = capture_func

        self.lifecycle = self.options.get("profile_lifecycle")
        profile_session_sample_rate = self.options.get("profile_session_sample_rate")
        self.sampled = determine_profile_session_sampling_decision(
            profile_session_sample_rate
        )

        self.sampler = self.make_sampler()
        self.buffer = None  # type: Optional[ProfileBuffer]
        self.pid = None  # type: Optional[int]

        self.running = False

        self.new_profiles = deque(maxlen=128)  # type: Deque[ContinuousProfile]
        self.active_profiles = set()  # type: Set[ContinuousProfile]

    def is_auto_start_enabled(self):
        # type: () -> bool

        # Ensure that the scheduler only autostarts once per process.
        # This is necessary because many web servers use forks to spawn
        # additional processes. And the profiler is only spawned on the
        # master process, then it often only profiles the main process
        # and not the ones where the requests are being handled.
        if self.pid == os.getpid():
            return False

        experiments = self.options.get("_experiments")
        if not experiments:
            return False

        return experiments.get("continuous_profiling_auto_start")

    def auto_start(self):
        # type: () -> Union[ContinuousProfile, None]
        if not self.sampled:
            return None

        if self.lifecycle != "trace":
            return None

        logger.debug("[Profiling] Auto starting profiler")

        profile = ContinuousProfile()

        self.new_profiles.append(profile)
        self.ensure_running()

        return profile

    def manual_start(self):
        # type: () -> None
        if not self.sampled:
            return

        if self.lifecycle != "manual":
            return

        self.ensure_running()

    def manual_stop(self):
        # type: () -> None
        if self.lifecycle != "manual":
            return

        self.teardown()

    def ensure_running(self):
        # type: () -> None
        raise NotImplementedError

    def teardown(self):
        # type: () -> None
        raise NotImplementedError

    def pause(self):
        # type: () -> None
        raise NotImplementedError

    def reset_buffer(self):
        # type: () -> None
        self.buffer = ProfileBuffer(
            self.options, self.sdk_info, PROFILE_BUFFER_SECONDS, self.capture_func
        )

    @property
    def profiler_id(self):
        # type: () -> Union[str, None]
        if self.buffer is None:
            return None
        return self.buffer.profiler_id

    def make_sampler(self):
        # type: () -> Callable[..., None]
        cwd = os.getcwd()

        cache = LRUCache(max_size=256)

        if self.lifecycle == "trace":

            def _sample_stack(*args, **kwargs):
                # type: (*Any, **Any) -> None
                """
                Take a sample of the stack on all the threads in the process.
                This should be called at a regular interval to collect samples.
                """

                # no profiles taking place, so we can stop early
                if not self.new_profiles and not self.active_profiles:
                    self.running = False
                    return

                # This is the number of profiles we want to pop off.
                # It's possible another thread adds a new profile to
                # the list and we spend longer than we want inside
                # the loop below.
                #
                # Also make sure to set this value before extracting
                # frames so we do not write to any new profiles that
                # were started after this point.
                new_profiles = len(self.new_profiles)

                ts = now()

                try:
                    sample = [
                        (str(tid), extract_stack(frame, cache, cwd))
                        for tid, frame in sys._current_frames().items()
                    ]
                except AttributeError:
                    # For some reason, the frame we get doesn't have certain attributes.
                    # When this happens, we abandon the current sample as it's bad.
                    capture_internal_exception(sys.exc_info())
                    return

                # Move the new profiles into the active_profiles set.
                #
                # We cannot directly add the to active_profiles set
                # in `start_profiling` because it is called from other
                # threads which can cause a RuntimeError when it the
                # set sizes changes during iteration without a lock.
                #
                # We also want to avoid using a lock here so threads
                # that are starting profiles are not blocked until it
                # can acquire the lock.
                for _ in range(new_profiles):
                    self.active_profiles.add(self.new_profiles.popleft())
                inactive_profiles = []

                for profile in self.active_profiles:
                    if profile.active:
                        pass
                    else:
                        # If a profile is marked inactive, we buffer it
                        # to `inactive_profiles` so it can be removed.
                        # We cannot remove it here as it would result
                        # in a RuntimeError.
                        inactive_profiles.append(profile)

                for profile in inactive_profiles:
                    self.active_profiles.remove(profile)

                if self.buffer is not None:
                    self.buffer.write(ts, sample)

        else:

            def _sample_stack(*args, **kwargs):
                # type: (*Any, **Any) -> None
                """
                Take a sample of the stack on all the threads in the process.
                This should be called at a regular interval to collect samples.
                """

                ts = now()

                try:
                    sample = [
                        (str(tid), extract_stack(frame, cache, cwd))
                        for tid, frame in sys._current_frames().items()
                    ]
                except AttributeError:
                    # For some reason, the frame we get doesn't have certain attributes.
                    # When this happens, we abandon the current sample as it's bad.
                    capture_internal_exception(sys.exc_info())
                    return

                if self.buffer is not None:
                    self.buffer.write(ts, sample)

        return _sample_stack

    def run(self):
        # type: () -> None
        last = time.perf_counter()

        while self.running:
            self.sampler()

            # some time may have elapsed since the last time
            # we sampled, so we need to account for that and
            # not sleep for too long
            elapsed = time.perf_counter() - last
            if elapsed < self.interval:
                thread_sleep(self.interval - elapsed)

            # after sleeping, make sure to take the current
            # timestamp so we can use it next iteration
            last = time.perf_counter()

        if self.buffer is not None:
            self.buffer.flush()
            self.buffer = None


class ThreadContinuousScheduler(ContinuousScheduler):
    """
    This scheduler is based on running a daemon thread that will call
    the sampler at a regular interval.
    """

    mode = "thread"  # type: ContinuousProfilerMode
    name = "sentry.profiler.ThreadContinuousScheduler"

    def __init__(self, frequency, options, sdk_info, capture_func):
        # type: (int, Dict[str, Any], SDKInfo, Callable[[Envelope], None]) -> None
        super().__init__(frequency, options, sdk_info, capture_func)

        self.thread = None  # type: Optional[threading.Thread]
        self.lock = threading.Lock()

    def ensure_running(self):
        # type: () -> None

        pid = os.getpid()

        # is running on the right process
        if self.running and self.pid == pid:
            return

        with self.lock:
            # another thread may have tried to acquire the lock
            # at the same time so it may start another thread
            # make sure to check again before proceeding
            if self.running and self.pid == pid:
                return

            self.pid = pid
            self.running = True

            # if the profiler thread is changing,
            # we should create a new buffer along with it
            self.reset_buffer()

            # make sure the thread is a daemon here otherwise this
            # can keep the application running after other threads
            # have exited
            self.thread = threading.Thread(name=self.name, target=self.run, daemon=True)

            try:
                self.thread.start()
            except RuntimeError:
                # Unfortunately at this point the interpreter is in a state that no
                # longer allows us to spawn a thread and we have to bail.
                self.running = False
                self.thread = None

    def teardown(self):
        # type: () -> None
        if self.running:
            self.running = False

        if self.thread is not None:
            self.thread.join()
            self.thread = None

        self.buffer = None


class GeventContinuousScheduler(ContinuousScheduler):
    """
    This scheduler is based on the thread scheduler but adapted to work with
    gevent. When using gevent, it may monkey patch the threading modules
    (`threading` and `_thread`). This results in the use of greenlets instead
    of native threads.

    This is an issue because the sampler CANNOT run in a greenlet because
    1. Other greenlets doing sync work will prevent the sampler from running
    2. The greenlet runs in the same thread as other greenlets so when taking
       a sample, other greenlets will have been evicted from the thread. This
       results in a sample containing only the sampler's code.
    """

    mode = "gevent"  # type: ContinuousProfilerMode

    def __init__(self, frequency, options, sdk_info, capture_func):
        # type: (int, Dict[str, Any], SDKInfo, Callable[[Envelope], None]) -> None

        if ThreadPool is None:
            raise ValueError("Profiler mode: {} is not available".format(self.mode))

        super().__init__(frequency, options, sdk_info, capture_func)

        self.thread = None  # type: Optional[_ThreadPool]
        self.lock = threading.Lock()

    def ensure_running(self):
        # type: () -> None
        pid = os.getpid()

        # is running on the right process
        if self.running and self.pid == pid:
            return

        with self.lock:
            # another thread may have tried to acquire the lock
            # at the same time so it may start another thread
            # make sure to check again before proceeding
            if self.running and self.pid == pid:
                return

            self.pid = pid
            self.running = True

            # if the profiler thread is changing,
            # we should create a new buffer along with it
            self.reset_buffer()

            self.thread = ThreadPool(1)  # type: ignore[misc]
            try:
                self.thread.spawn(self.run)
            except RuntimeError:
                # Unfortunately at this point the interpreter is in a state that no
                # longer allows us to spawn a thread and we have to bail.
                self.running = False
                self.thread = None

    def teardown(self):
        # type: () -> None
        if self.running:
            self.running = False

        if self.thread is not None:
            self.thread.join()
            self.thread = None

        self.buffer = None


PROFILE_BUFFER_SECONDS = 60


class ProfileBuffer:
    def __init__(self, options, sdk_info, buffer_size, capture_func):
        # type: (Dict[str, Any], SDKInfo, int, Callable[[Envelope], None]) -> None
        self.options = options
        self.sdk_info = sdk_info
        self.buffer_size = buffer_size
        self.capture_func = capture_func

        self.profiler_id = uuid.uuid4().hex
        self.chunk = ProfileChunk()

        # Make sure to use the same clock to compute a sample's monotonic timestamp
        # to ensure the timestamps are correctly aligned.
        self.start_monotonic_time = now()

        # Make sure the start timestamp is defined only once per profiler id.
        # This prevents issues with clock drift within a single profiler session.
        #
        # Subtracting the start_monotonic_time here to find a fixed starting position
        # for relative monotonic timestamps for each sample.
        self.start_timestamp = (
            datetime.now(timezone.utc).timestamp() - self.start_monotonic_time
        )

    def write(self, monotonic_time, sample):
        # type: (float, ExtractedSample) -> None
        if self.should_flush(monotonic_time):
            self.flush()
            self.chunk = ProfileChunk()
            self.start_monotonic_time = now()

        self.chunk.write(self.start_timestamp + monotonic_time, sample)

    def should_flush(self, monotonic_time):
        # type: (float) -> bool

        # If the delta between the new monotonic time and the start monotonic time
        # exceeds the buffer size, it means we should flush the chunk
        return monotonic_time - self.start_monotonic_time >= self.buffer_size

    def flush(self):
        # type: () -> None
        chunk = self.chunk.to_json(self.profiler_id, self.options, self.sdk_info)
        envelope = Envelope()
        envelope.add_profile_chunk(chunk)
        self.capture_func(envelope)


class ProfileChunk:
    def __init__(self):
        # type: () -> None
        self.chunk_id = uuid.uuid4().hex

        self.indexed_frames = {}  # type: Dict[FrameId, int]
        self.indexed_stacks = {}  # type: Dict[StackId, int]
        self.frames = []  # type: List[ProcessedFrame]
        self.stacks = []  # type: List[ProcessedStack]
        self.samples = []  # type: List[ProcessedSample]

    def write(self, ts, sample):
        # type: (float, ExtractedSample) -> None
        for tid, (stack_id, frame_ids, frames) in sample:
            try:
                # Check if the stack is indexed first, this lets us skip
                # indexing frames if it's not necessary
                if stack_id not in self.indexed_stacks:
                    for i, frame_id in enumerate(frame_ids):
                        if frame_id not in self.indexed_frames:
                            self.indexed_frames[frame_id] = len(self.indexed_frames)
                            self.frames.append(frames[i])

                    self.indexed_stacks[stack_id] = len(self.indexed_stacks)
                    self.stacks.append(
                        [self.indexed_frames[frame_id] for frame_id in frame_ids]
                    )

                self.samples.append(
                    {
                        "timestamp": ts,
                        "thread_id": tid,
                        "stack_id": self.indexed_stacks[stack_id],
                    }
                )
            except AttributeError:
                # For some reason, the frame we get doesn't have certain attributes.
                # When this happens, we abandon the current sample as it's bad.
                capture_internal_exception(sys.exc_info())

    def to_json(self, profiler_id, options, sdk_info):
        # type: (str, Dict[str, Any], SDKInfo) -> Dict[str, Any]
        profile = {
            "frames": self.frames,
            "stacks": self.stacks,
            "samples": self.samples,
            "thread_metadata": {
                str(thread.ident): {
                    "name": str(thread.name),
                }
                for thread in threading.enumerate()
            },
        }

        set_in_app_in_frames(
            profile["frames"],
            options["in_app_exclude"],
            options["in_app_include"],
            options["project_root"],
        )

        payload = {
            "chunk_id": self.chunk_id,
            "client_sdk": {
                "name": sdk_info["name"],
                "version": VERSION,
            },
            "platform": "python",
            "profile": profile,
            "profiler_id": profiler_id,
            "version": "2",
        }

        for key in "release", "environment", "dist":
            if options[key] is not None:
                payload[key] = str(options[key]).strip()

        return payload
