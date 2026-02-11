from typing import Any

import sentry_sdk
from django.db.models import CharField

from ._base import EncryptedField


class EncryptedCharField(EncryptedField, CharField):
    @sentry_sdk.trace
    def from_db_value(self, value: Any, expression: Any, connection: Any) -> Any:
        db_value = super().from_db_value(value, expression, connection)
        if db_value is None:
            return db_value
        if isinstance(db_value, bytes):
            db_value = db_value.decode("utf-8")
        return db_value
