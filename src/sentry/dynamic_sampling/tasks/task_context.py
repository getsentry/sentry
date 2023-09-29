import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Union


@dataclass
class DynamicSamplingLogState:
    """
    Stats accumulated about the running of a dynamic sampling function or iterator

    A particular function may not use all stats
    """

    num_rows_total: int = 0
    num_db_calls: int = 0
    num_iterations: int = 0
    num_projects: int = 0
    num_orgs: int = 0
    execution_time: float = 0.0

    def to_dict(self) -> Dict[str, Union[int, float]]:
        return {
            "numRowsTotal": self.num_rows_total,
            "numDbCalls": self.num_db_calls,
            "numIterations": self.num_iterations,
            "numProjects": self.num_projects,
            "numOrgs": self.num_orgs,
            "executionTime": self.execution_time,
        }

    def increment(
        self,
        num_rows_total: int = 0,
        num_db_calls: int = 0,
        num_iterations: int = 0,
        num_projects: int = 0,
        num_orgs: int = 0,
    ) -> "DynamicSamplingLogState":
        self.num_rows_total += num_rows_total
        self.num_db_calls += num_db_calls
        self.num_iterations += num_iterations
        self.num_projects += num_projects
        self.num_orgs += num_orgs

        return self

    @staticmethod
    def from_dict(val: Optional[Dict[Any, Any]]) -> "DynamicSamplingLogState":
        if val is not None:
            return DynamicSamplingLogState(
                num_iterations=val.get("numIterations", 0),
                num_db_calls=val.get("numDbCalls", 0),
                num_rows_total=val.get("numRowsTotal", 0),
                num_projects=val.get("numProjects", 0),
                num_orgs=val.get("numOrgs", 0),
                execution_time=val.get("executionTime", 0.0),
            )
        else:
            return DynamicSamplingLogState()


@dataclass
class TaskContext:
    """
    Keeps information about a running task

    * the name
    * the amount of time is allowed to run (until a TimeoutError should be emitted)
    * stats about the task operation (how many items it has processed) used for logging
    * keeps a Timers object that manages multiple named timers for tracking execution time of functions.
    """

    name: str
    num_seconds: float
    context_data: Optional[Dict[str, DynamicSamplingLogState]] = None

    def __post_init__(self):
        # always override
        self.expiration_time = time.monotonic() + self.num_seconds
        if self.context_data is None:
            self.context_data = {}
        self.timers = Timers()

    def set_function_state(self, function_id: str, log_state: DynamicSamplingLogState):
        if self.context_data is None:
            self.context_data = {}

        self.context_data[function_id] = log_state

    def get_function_state(self, function_id: str) -> DynamicSamplingLogState:
        default = DynamicSamplingLogState()

        if self.context_data is None:
            return default
        else:
            return self.context_data.get(function_id, default)

    def incr_function_state(
        self,
        function_id: str,
        num_rows_total: int = 0,
        num_db_calls: int = 0,
        num_iterations: int = 0,
        num_projects: int = 0,
        num_orgs: int = 0,
    ):
        self.set_function_state(
            function_id,
            self.get_function_state(function_id).increment(
                num_rows_total, num_db_calls, num_iterations, num_projects, num_orgs
            ),
        )

    def get_timer(self, name) -> "NamedTimer":
        return self.timers.get_timer(name)

    def to_dict(self) -> Dict[str, Any]:
        ret_val = {
            "taskName": self.name,
            "maxSeconds": self.num_seconds,
            "seconds": time.monotonic() - self.expiration_time + self.num_seconds,
        }
        task_data: Dict[str, Any] = {}
        if self.context_data is not None:
            # update the execution time for each function
            for name, state in self.context_data.items():
                state.execution_time = self.timers.current(name)
            task_data = {k: v.to_dict() for k, v in self.context_data.items()}

        # create entries for timer data without context data
        for name in self.timers.timers.keys():
            if name not in task_data:
                # timer with no state
                timer = self.timers.get_timer(name)
                task_data[name] = DynamicSamplingLogState(execution_time=timer.current()).to_dict()
        ret_val["taskData"] = task_data
        return ret_val


@dataclass
class TimerState:
    elapsed: float
    started: Optional[float]


class Timers:
    """
    Keeps the state of many named timers.

    Individual timers will be created at first use.
    Users should not use this class directly, but use the NamedTimer class instead.
    TaskContext uses this class to keep track of timers.
    For using timers for functions use TaskContext.get_timer("<name>") to get a NamedTimer.

    """

    def __init__(self):
        self.timers: Dict[str, TimerState] = {}

    def get_timer(self, name: str) -> "NamedTimer":
        return NamedTimer(name, self)

    def start(self, name: str) -> float:
        state = self.get_timer_state(name)
        if not state.started:
            state.started = time.monotonic()
        return self.current(name)

    def stop(self, name: str) -> float:
        state = self.get_timer_state(name)
        if state.started:
            state.elapsed += time.monotonic() - state.started
        state.started = None
        return self.current(name)

    def current(self, name: str) -> float:
        state = self.get_timer_state(name)
        if state.started:
            return state.elapsed + time.monotonic() - state.started
        return state.elapsed

    def get_timer_state(self, name: str) -> TimerState:
        state = self.timers.get(name)
        if state is None:
            state = TimerState(elapsed=0, started=None)
            self.timers[name] = state
        return state

    def __str__(self) -> str:
        return str({name: self.current(name) for name in self.timers.keys()})


class NamedTimer:
    """
    Interface for a single timer.

    The class only keeps a reference to the Timers object and the name of the timer.
    There is no state kept in this class so multiple instances for the same timer can be created sequentially and
    used and the same timer will be updated.
    Example:
        task_context = TaskContext("my_task", 100)

        for i in range(10):
            with task_context.get_timer("my_timer") as timer:
                time.sleep(1)

        t = task_context.get_timer("my_timer")
        # 1 second for each iteration ( all 10 instances update the same timer)
        assert t.current() == 10
    """

    def __init__(self, name: str, timers: Timers):
        self.name = name
        self.timers = timers

    def __enter__(self):
        self.timers.start(self.name)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.timers.stop(self.name)
        return False

    def start(self) -> float:
        return self.timers.start(self.name)

    def stop(self) -> float:
        return self.timers.stop(self.name)

    def current(self) -> float:
        return self.timers.current(self.name)

    def get_timer_state(self) -> TimerState:
        return self.timers.get_timer_state(self.name)
