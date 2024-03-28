from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class ExceedsBudgetRequest(_message.Message):
    __slots__ = ("config_name", "project_id")
    CONFIG_NAME_FIELD_NUMBER: _ClassVar[int]
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    config_name: str
    project_id: int
    def __init__(self, config_name: _Optional[str] = ..., project_id: _Optional[int] = ...) -> None: ...

class RecordSpendingRequest(_message.Message):
    __slots__ = ("config_name", "project_id", "spent")
    CONFIG_NAME_FIELD_NUMBER: _ClassVar[int]
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    SPENT_FIELD_NUMBER: _ClassVar[int]
    config_name: str
    project_id: int
    spent: float
    def __init__(self, config_name: _Optional[str] = ..., project_id: _Optional[int] = ..., spent: _Optional[float] = ...) -> None: ...

class ExceedsBudgetReply(_message.Message):
    __slots__ = ("exceeds_budget",)
    EXCEEDS_BUDGET_FIELD_NUMBER: _ClassVar[int]
    exceeds_budget: bool
    def __init__(self, exceeds_budget: bool = ...) -> None: ...
