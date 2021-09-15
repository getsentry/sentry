from typing import Dict, Optional, Union

from rest_framework import serializers

from sentry.utils import json


class SecretField(serializers.Field):  # type: ignore
    """
    A validator for a secret-containing field whose values are either a string or a magic object.

    This validator should be used when secrets are known to have previous values already stored on
    the server, i.e. they may be in the form of a magic object representing a redacted secret.
    """

    def __init__(self, *args, **kwargs):  # type: ignore
        super().__init__(*args, **kwargs)
        self.string_field = serializers.CharField(min_length=1, max_length=512, *args, **kwargs)
        self.magic_object_field = serializers.DictField(
            child=serializers.BooleanField(required=True), allow_empty=False, *args, **kwargs
        )

    def to_representation(self, obj):  # type: ignore
        if isinstance(obj, dict):
            return self.magic_object_field.to_representation(obj)
        return self.string_field.to_representation(obj)

    def to_internal_value(self, data):  # type: ignore
        if isinstance(data, dict):
            return self.magic_object_field.to_internal_value(data)
        self.string_field.run_validation(data)
        return self.string_field.to_internal_value(data)


def validate_secret(secret: Optional[Union[str, Dict[str, bool]]]) -> Optional[json.JSONData]:
    """
    Validates the contents of a field containing a secret that may have a magic object representing
    some existing value already stored on the server.

    Returns None if the magic object is found, indicating that the field should be back-filled by
    that existing value.
    """

    if not secret:
        return secret

    # If an object was returned then it must be the special value representing the currently
    # stored secret, i.e. no change was made to it
    if isinstance(secret, dict):
        if secret.get("hidden-secret") is True:
            return None
        raise serializers.ValidationError("Invalid magic object for secret")

    # Field validation should have already checked everything else.
    return secret
