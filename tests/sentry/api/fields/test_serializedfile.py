import unittest
from base64 import b64encode
from io import BytesIO

import pytest
from rest_framework import serializers

from sentry.api.fields.serializedfile import FileUpload, SerializedFileField


# XXX: ideally we'd have an integration test covering this field, but at the time of writing its unused in this codebase
class SerializedFileFieldTest(unittest.TestCase):
    def test_to_representation(self):
        field = SerializedFileField()

        assert field.to_representation(None) == ""
        assert field.to_representation("") == ""
        with pytest.raises(ValueError):
            assert field.to_representation(1)

        result = field.to_representation(
            FileUpload(name="filename.txt", content=BytesIO(b"hello world"))
        )
        assert result == ["filename.txt", "aGVsbG8gd29ybGQ="]

    def test_to_internal_value(self):
        field = SerializedFileField()

        assert field.to_internal_value("") is None
        assert field.to_internal_value(None) is None
        with pytest.raises(serializers.ValidationError):
            assert field.to_internal_value(True)

        result = field.to_internal_value(["filename.txt", b64encode(b"hello world")])
        assert isinstance(result, FileUpload)
        assert result.name == "filename.txt"
        assert result.content.getvalue() == b"hello world"
