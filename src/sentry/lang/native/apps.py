from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.lang.native"

    def ready(self) -> None:
        # Force the grouptype module to load at Django startup so its
        # `__init_subclass__` registers `GpuCrashGroupType` with the global
        # GroupType registry — and the auto-generated `organizations:issue-
        # gpu-crash-{ingest,post-process-group,visible}` features land in
        # the feature manager — in every Sentry process (devserver,
        # occurrence consumer, symbolication taskworker, ...), not just the
        # one that happens to invoke `process_gpu_crash_dump` first.
        from . import grouptype  # noqa: F401
