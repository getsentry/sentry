import time
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass

from sentry.utils import metrics


@dataclass
class UploadMeasurement:
    upload_size: int | None
    compression: str | None


@contextmanager
def measure_storage_put(
    upload_size: int | None, usecase: str, compression: str | None = None
) -> Generator[UploadMeasurement]:
    measurement = UploadMeasurement(upload_size, compression)
    start = time.monotonic()
    try:
        yield measurement
    finally:
        elapsed = time.monotonic() - start
        metrics.timing("storage.put.latency", elapsed, tags={"usecase": usecase})

        if upload_size := measurement.upload_size:
            metrics.distribution(
                "storage.put.size",
                upload_size,
                tags={"usecase": usecase, "compression": measurement.compression or "none"},
                unit="byte",
            )
            if elapsed > 0:
                metrics.distribution(
                    "storage.put.throughput", upload_size / elapsed, tags={"usecase": usecase}
                )
