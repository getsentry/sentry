from typing import Optional, Union

from .base import MetricsBackend, Tags

__all__ = ["DummyMetricsBackend"]


class DummyMetricsBackend(MetricsBackend):
    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        pass

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        pass

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        pass

    def distribution(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        pass
