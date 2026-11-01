from typing import Any

class Unsafe:
    ADD_COLUMN_NOT_NULL: Any
    ALTER_COLUMN_TYPE: Any
    ADD_CONSTRAINT_EXCLUDE: Any
    ALTER_TABLE_SET_TABLESPACE: Any
    ALTER_TABLE_RENAME_COLUMN: Any

class UnsafeOperationException(Exception): ...
class DatabaseSchemaEditorMixin: ...
