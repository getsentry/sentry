from enum import IntEnum

class CategoryUnit(IntEnum):
    COUNT = 0
    BYTES = 1
    MILLISECONDS = 2

class DataCategory(IntEnum):
    DEFAULT = 0
    ERROR = 1
    TRANSACTION = 2
    SECURITY = 3
    ATTACHMENT = 4
    SESSION = 5
    PROFILE = 6
    REPLAY = 7
    TRANSACTION_PROCESSED = 8
    TRANSACTION_INDEXED = 9
    MONITOR = 10
    PROFILE_INDEXED = 11
    SPAN = 12
    MONITOR_SEAT = 13
    USER_REPORT_V2 = 14
    METRIC_BUCKET = 15
    SPAN_INDEXED = 16
    PROFILE_DURATION = 17
    PROFILE_CHUNK = 18
    METRIC_SECOND = 19
    DO_NOT_USE_REPLAY_VIDEO = 20
    UPTIME = 21
    ATTACHMENT_ITEM = 22
    LOG_ITEM = 23
    LOG_BYTE = 24
    PROFILE_DURATION_UI = 25
    PROFILE_CHUNK_UI = 26
    SEER_AUTOFIX = 27
    SEER_SCANNER = 28
    PREVENT_USER = 29
    PREVENT_REVIEW = 30
    SIZE_ANALYSIS = 31
    INSTALLABLE_BUILD = 32
    TRACE_METRIC = 33
    SEER_USER = 34
    PROFILE_BACKEND = 35
    PROFILE_UI = 36
    TRACE_METRIC_BYTE = 37
    SNAPSHOT_IMAGE = 38
    UNKNOWN = -1
    @classmethod
    def parse(cls, name: str | None) -> DataCategory | None: ...
    @classmethod
    def from_event_type(cls, event_type: str | None) -> DataCategory: ...
    @classmethod
    def event_categories(cls) -> list[DataCategory]: ...
    @classmethod
    def error_categories(cls) -> list[DataCategory]: ...
    def api_name(self) -> str: ...

SPAN_STATUS_CODE_TO_NAME: dict[int, str]
SPAN_STATUS_NAME_TO_CODE: dict[str, int]
