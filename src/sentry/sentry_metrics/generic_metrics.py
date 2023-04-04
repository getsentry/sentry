from typing import Any

# import register_use_case

# def emit_counter() -> MetricCounter
# build the Kafka payload
# verify the use case is valid
# send to DummyBackend

# def emit_set() -> MetricSet


# def emit_distribution() -> MetricDistribution


class MetricsInterface:
    def __init__(self, metrics: Any) -> None:
        # internally used metrics backend
        self.__metrics = metrics

    # def emit_counter():

    # def emit_set():

    # def emit_distribution():
