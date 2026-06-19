from django.db import models
from django.db.models.fields import _GT, _ST

I32_MAX: int
U32_MAX: int
I64_MAX: int

class BoundedIntegerField(models.IntegerField[_ST, _GT]):
    MAX_VALUE: int
    def get_prep_value(self, value: int) -> int: ...

class BoundedPositiveIntegerField(models.PositiveIntegerField[_ST, _GT]):
    MAX_VALUE: int
    def get_prep_value(self, value: int) -> int: ...

class WrappingU32IntegerField(models.IntegerField[_ST, _GT]):
    MIN_VALUE: int
    MAX_VALUE: int
    def get_prep_value(self, value: int) -> int: ...
    def from_db_value(
        self, value: int | None, expression: object, connection: object
    ) -> int | None: ...

class BoundedAutoField(models.AutoField[_ST, _GT]):
    MAX_VALUE: int
    def get_prep_value(self, value: int) -> int: ...

class BoundedBigIntegerField(models.BigIntegerField[_ST, _GT]):
    MAX_VALUE: int
    def get_internal_type(self) -> str: ...
    def get_prep_value(self, value: int) -> int: ...

class BoundedPositiveBigIntegerField(models.PositiveBigIntegerField[_ST, _GT]):
    MAX_VALUE: int
    def get_internal_type(self) -> str: ...
    def get_prep_value(self, value: int) -> int: ...

class BoundedBigAutoField(models.BigAutoField[_ST, _GT]):
    MAX_VALUE: int
    def get_internal_type(self) -> str: ...
    def get_prep_value(self, value: int) -> int: ...
