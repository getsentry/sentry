"""
Analysis of INC-1184.  Production backlog of four partitions (two consumers) of the
ingest-replay-recordings Kafka consumer.

These cases are partially taken from a real production incident with commentary from participants
included to provide background for each test case. At the end of this file a conclusion is reached.
The full post-mortem is documented in Notion.

Background:
The number of workers in our 'upload to GCS step' was increased from 8 to 16. A backlog formed on
four partitions. The number of workers was increased to 32 in an attempt to remedy the situation
but it made the situation slightly worse. Resetting the worker count back to 8 quickly burned the
backlog and we were back to normal.
"""

import time
from threading import Semaphore

from arroyo.processing.strategies import RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import MessageRejected, ProcessingStrategy
from arroyo.types import FilteredPayload, Message, Value


class Producer:
    def __init__(self, step):
        self.step = step
        self.produced_count = 0

    def submit(self):
        self.step.submit(Message(Value(None, {}, None)))
        self.produced_count += 1

    def poll(self):
        self.step.poll()


class Consumer(ProcessingStrategy[FilteredPayload | None]):
    def __init__(self):
        self.consumed_count = 0

    def submit(self, message):
        self.consumed_count += 1

    def poll(self): ...

    def close(self): ...

    def join(self, timeout=None): ...

    def terminate(self): ...


class SharedResource:
    def __init__(self, max_workers, wait):
        self.lock = Semaphore(max_workers)
        self.wait = wait

    def __call__(self):
        with self.lock:
            time.sleep(self.wait)


# Fixture


def case(step_workers, step_queue_depth, shared_resource_workers, shared_resource_work_time):
    shared = SharedResource(shared_resource_workers, wait=shared_resource_work_time)
    consumer = Consumer()

    def processor(m):
        shared()  # lock and sleep

    def run_task_work(m):
        # useless work in a loop to emulate processing.
        for i in range(10_000):
            i / 0.1
        return m

    step = RunTask(
        function=run_task_work,
        next_step=RunTaskInThreads(
            processing_function=processor,
            concurrency=step_workers,
            max_pending_futures=step_queue_depth,
            next_step=consumer,
        ),
    )

    producer = Producer(step)

    return producer, consumer, step


# Test Cases


def test1_unbalanced_worker_counts():
    """
    Background:
    "10 connections are available. 8 threads: which means we never see backpressure. We go to 16
    threads. Now 6 threads are waiting. That means when the 17th message shows up we backpressure."

    Hypothesis:
    The number of workers must be balanced with the number of workers in the shared resource. If
    they are not balanced when num_threads + 1 messages arrive, if no thread has completed
    processing their message, a MessageRejected error will be raised.

    Result:
    A MessageRejected error is not raised when the workers have all acquired a message. The queue
    is able to buffer all produced messages.
    """
    producer, consumer, step = case(
        step_workers=4,
        step_queue_depth=10,
        shared_resource_workers=2,
        shared_resource_work_time=0.001,
    )

    # We eagerly fill the queue.
    for _ in range(10):
        producer.submit()

    assert producer.produced_count == 10
    assert consumer.consumed_count == 0

    # Queue is drained.
    time.sleep(0.01)
    producer.poll()

    assert producer.produced_count == 10
    assert consumer.consumed_count == 10


def test2_insufficient_queue_depth():
    """
    Background:
    "two steps. processor and commit. processor pushes to a queue. threads pick up message off the
    queue. a thread goes to use the connection pool which is full. it acquires a lock and yields
    to the os. all 16 threads are either using the pool or locked. processor step is pushing into
    the queue still. the queue fills and then message rejected is raised which signals
    backpressure."

    Hypothesis:
    The queue depth controls the MessageRejected error. If messages arrive faster than they can
    be processed a MessageRejected error is raised.

    Result:
    A MessageRejected error is raised when queue depth is exceeded.
    """
    producer, consumer, step = case(
        step_workers=4,
        step_queue_depth=10,
        shared_resource_workers=2,
        shared_resource_work_time=0.001,
    )

    # We eagerly fill the queue. This for some unknown reason requires 11 messages even though 10
    # is specified in the definition as the max depth.
    for _ in range(11):
        producer.submit()

    assert producer.produced_count == 11
    assert consumer.consumed_count == 0

    try:
        producer.submit()
        assert False, "Message should have been rejected."
    except MessageRejected:
        ...


def test3_over_production_hogs_cpu_time_leading_to_starvation():
    """
    Background:
    "Because every time a MessageRejected is is raised by the commit step, it happens when process
    submits to commit. by re-parsing the same message over and over in a tight loop we also steal
    the GIL from everything else."

    Hypothesis:
    When MessageRejected in raised in a tight loop it steals resources from the threadpool. The
    pool can make progress but much more slowly than if the messages arrived more evenly or had a
    large enough queue to accommodate them.

    Result:
    Tight production in a loop resulted in greater than 70 milliseconds of system time. Producing
    in a tight loop had a deleterious affect on performance. Expected system time without thrashing
    roughly 7 milliseconds.

    Additional Follow Up:
    "my question is why would 6 threads holding a lock crush throughput so much.". Holding the
    lock had no impact. Resource starvation from the over-eager main thread was not sharing
    resources appropriately with the workers.
    """
    # Workers are balanced and queue depth is INSUFFICIENT for production load. Messages will be
    # rejected.
    producer, consumer, _ = case(
        step_workers=10,
        step_queue_depth=50,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(100):
        # Produce in a loop until the step accepts our message.
        while True:
            # Mirroring StreamProcessor classes behavior. We poll first. This ensures we're making
            # progress. The submit method won't empty the queue on its own. We always poll first.
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        # Progress the queue.
        producer.poll()

        # Check the queue is empty and break or wait.
        if consumer.consumed_count == 100:
            break
        else:
            # Sleep to prevent starvation.
            time.sleep(0.001)

    end = time.time()
    print("Test 3 duration", end - start)  # noqa
    # 65 ± 10 milliseconds.


def test4_high_production_to_queue_does_not_starve():
    """
    Background:
    "If they enqueued work indefinitively we would not see a backlog probably"

    Hypothesis:
    When MessageRejected is NOT raised in a tight loop the process has plenty of resources to
    complete on time.

    Result:
    When MessageRejected is NOT raised in a tight loop the process completed ~5x faster than
    when stuck in a tight loop.
    """
    # Workers are balanced and queue depth is SUFFICIENT for production load. Messages will NOT be
    # rejected.
    producer, consumer, _ = case(
        step_workers=10,
        step_queue_depth=100,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(100):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 100:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 4 duration", end - start)  # noqa
    # 40 ± 5 milliseconds.


def test5_modulated_message_rejected_intensity_from_production_patterns():
    """
    Background:
    During the incident the production environment was experiencing perodic load spikes. Production
    was not evenly submitted to the consumers and instead was held in batches by our producer.

    Hypothesis:
    A smooth production pattern results in lower total system time than a spikey production
    pattern.

    Result:
    100 messages with a smooth production pattern completed nearly 6x faster than the same set
    of messages with a spikey production pattern. Resource starvation by the MessageRejected retry
    logic has significant impact on the process's ability to make progress.
    """
    # Workers are balanced. Queue depth is small.
    producer, consumer, _ = case(
        step_workers=1,
        step_queue_depth=2,
        shared_resource_workers=1,
        shared_resource_work_time=0.001,
    )

    #
    # SMOOTH PRODUCTION PATTERN
    #

    start = time.time()

    for _ in range(100):
        # Producer smoothing. This matches production to consumption.
        time.sleep(0.001)

        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 100:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 5a duration", end - start)  # noqa
    # 170 ± 5 milliseconds.

    #
    # SPIKEY PRODUCTION PATTERN
    #

    start = time.time()

    for _ in range(100):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 100:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 5b duration", end - start)  # noqa
    # 740 ± 40 milliseconds.


def test6_production_patterns_with_unbalanced_threads():
    """
    Background:
    During the production incident resolution was driven by lowering the number of threads the
    consumer process had to mirror the number of concurrent accesses the shared resource would
    allow.

    Hypothesis:
    Lowering the number of threads significantly improves total system time in the precense of an
    insufficiently deep queue.

    Result:
    Total system time was on average lower with a balanced number of threads than unbalanced. A
    ~30% difference in performance was observed in favor of balanced threads.
    """
    #
    # UNBALANCED WORKER POOL
    #

    producer, consumer, _ = case(
        step_workers=20,
        step_queue_depth=50,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(1000):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 1000:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 6a duration", end - start)  # noqa
    # 1300 ± 10 milliseconds.

    #
    # BALANCED WORKER POOL
    #

    producer, consumer, _ = case(
        step_workers=10,
        step_queue_depth=50,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(1000):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 1000:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 6b duration", end - start)  # noqa
    # 1000 ± 50 milliseconds.


def test7_production_patterns_with_unbalanced_threads_with_sufficient_queue_depth():
    """
    Background:
    During the production incident resolution was driven by lowering the number of threads the
    consumer process had to mirror the number of concurrent accesses the shared resource would
    allow.

    Hypothesis:
    Lowering the number of threads significantly improves total system time even in the precense
    of a sufficiently deep queue.

    Result:
    Negated result. An insignificant performance delta was observed between the balanced and
    unbalanced workers.
    """
    #
    # UNBALANCED WORKER POOL
    #

    producer, consumer, _ = case(
        step_workers=20,
        step_queue_depth=1000,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(1000):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 1000:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 7a duration", end - start)  # noqa
    # 400 ± 5 milliseconds.

    #
    # BALANCED WORKER POOL
    #

    producer, consumer, _ = case(
        step_workers=10,
        step_queue_depth=1000,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start = time.time()

    for _ in range(1000):
        while True:
            producer.poll()
            try:
                producer.submit()
                break
            except MessageRejected:
                continue

    while True:
        producer.poll()
        if consumer.consumed_count >= 1000:
            break
        else:
            time.sleep(0.001)

    end = time.time()
    print("Test 7b duration", end - start)  # noqa
    # 400 ± 5 milliseconds.


def test8_introducing_backoff_reduces_starvation():
    """
    Background:
    This test is idential to test3 except we sleep after each message rejected.

    Hypothesis:
    Sleeping after receiving a MessageRejected response will reduce contention and improve overall
    system throughput.

    Result:
    Sleeping improved system throughput by roughly ~5x. From ~60-80ms to ~15ms. It offers roughly
    similar performance benefit as increasing the queue depth without the associated increase in
    memory usage.
    """
    # Workers are balanced and queue depth is insufficient for production load. Messages will be
    # rejected.
    producer1, consumer1, _ = case(
        step_workers=10,
        step_queue_depth=50,
        shared_resource_workers=10,
        shared_resource_work_time=0.001,
    )

    start1 = time.time()

    for _ in range(100):
        # Produce in a loop until the step accepts our message. That's why the call this test
        # Mr. Farenheit.
        while True:
            # Mirroring StreamProcessor classes behavior. We poll first. This ensures we're making
            # progress. The submit method won't empty the queue on its own. We always poll first.
            producer1.poll()
            try:
                producer1.submit()
                break
            except MessageRejected:
                time.sleep(0.001)
                continue

    while True:
        # Progress the queue.
        producer1.poll()

        # Check the queue is empty and break or wait.
        if consumer1.consumed_count == 100:
            break
        else:
            time.sleep(0.001)

    end1 = time.time()
    print("Test 8 duration", end1 - start1)  # noqa
    # 40 ± 5 milliseconds.


if __name__ == "__main__":
    test1_unbalanced_worker_counts()
    test2_insufficient_queue_depth()
    test3_over_production_hogs_cpu_time_leading_to_starvation()
    test8_introducing_backoff_reduces_starvation()
    test4_high_production_to_queue_does_not_starve()
    test5_modulated_message_rejected_intensity_from_production_patterns()
    test6_production_patterns_with_unbalanced_threads()
    test7_production_patterns_with_unbalanced_threads_with_sufficient_queue_depth()


"""
Hypothesis:
A combination of spikey production volumes and unbalanced worker threads leaded to a lowering of
total system throughput. This lowering caused our consumption rate to be slightly slower than our
production rate. System deploys introduced backlog while the consumer was bootstrapping new code.
This lead to step changes in backlog which could not be burned down.

Result:
1. No evidence of significant MessageRejected volume was observed in the logs. Tight looping due
   to repeated MessageRejected leading to thread starvation can not be supported through the
   evidence available.
      - MessageRejected errors were observed in the logs for this consumer but not at sufficient
        volume to have caused the drop in throughput observed.  I.e. one error every few minutes.
2. No evidence of connection pool resources being exhausted. A search for logs matching the
   criteria "Connection pool is full" was made but results were found for others services only. No
   other service in Sentry produced logs.
      - Absense of evidence is not evidence of absense. Further investigation is needed to
        determine if the connection pool was full but not logged.
3. The consumption rate of the consumer recovered when the number of threads was lowered from 16/32
   to 8 and not before. This signifies the number of threads in the pool is a significant
   contributor to throughput, though, I could not reproduce that result in my tests and could
   find no log messages to support any starvation theory. CPU usage was not found to be
   significantly higher than is typical for that time of day.

Addendum:
It is unknown why only four partitions (two consumers) were affected while the others remained
functional. Some messages consume significantly more CPU time than others. The two backlogged
consumers may have had a disproportionate number of difficult messages to process. Or those
machines may have had poorer hardware or exhausted burst capacity. Page layout may have affected
the performance of those machines relative to the performance of the others.

Action Items:
1. Increase queue depth to absorb message production spikes.
    - This comes at the expense of higher memory usage which we have plenty of.
2. Catch MessageRejected exceptions, sleep for a small amount of time, and raise.
    - Since the exact amount of time, and processing capacity, it takes to unwind a consumer after
      a MessageRejected error is encountered is, at this moment, unknown and likely difficult to
      attain with certainty. This item is considered secondarily to increasing the queue depth. We
      have a significant amount of memory resources which are under utilized making this an easy
      solution with minimal thought, research, and room for error.
    - However should memory usage be constrained in the future this should be reconsidered.
      Documentation should be placed within the code that clearly calls out this trade-off.
3. Match the worker thread count to the connection pool's size.
    - It's wasted resources and useless context switching to have more threads than can actually
      perform work.
4. Increase connection pool size and explore higher worker concurrency performance.
    - Should I/O is this processor's bottleneck and not CPU time, increasing the number of
      connections in the connection pool and the number of worker threads should be an obvious
      next step.
"""
