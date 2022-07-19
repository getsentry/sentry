import pytest
from jsonschema import ValidationError


def invalid_schema(func):
    def inner(self, *args, **kwargs):
        with pytest.raises(ValidationError):
            func(self)

    return inner


def invalid_schema_with_error_message(message):
    def decorator(func):
        def inner(self, *args, **kwargs):
            with pytest.raises(ValidationError) as excinfo:
                func(self)
            assert excinfo.value.message == message

        return inner

    return decorator
