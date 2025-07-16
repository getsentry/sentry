import time
from collections.abc import Generator
from contextlib import contextmanager

from sentry.utils import metrics


@contextmanager
def measure_storage_put(
    upload_size: int, usecase: str, compression: str | None = None
) -> Generator[None]:
    metrics.distribution(
        "storage.put.size",
        upload_size,
        tags={"usecase": usecase, "compression": compression or "none"},
        unit="byte",
    )
    start = time.monotonic()
    try:
        yield
    finally:
        elapsed = time.monotonic() - start
        metrics.timing("storage.put.latency", elapsed, tags={"usecase": usecase})
        if elapsed > 0:
            metrics.distribution(
                "storage.put.throughput", upload_size / elapsed, tags={"usecase": usecase}
            )
