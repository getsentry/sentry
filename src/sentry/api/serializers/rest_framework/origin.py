from typing import cast

from rest_framework import serializers

from sentry.utils.http import parse_uri_match


class OriginField(serializers.CharField):
    WHITELIST_ORIGINS = "*"

    def to_internal_value(self, data: str) -> str:
        rv = super().to_internal_value(data)
        if not rv:
            return cast(str, None)
        self.validate_origin(rv)
        return rv

    def validate_origin(self, value: str) -> None:
        if value in self.WHITELIST_ORIGINS:
            return

        bits = parse_uri_match(value)
        if ":*" in bits.domain:
            raise serializers.ValidationError(
                "%s is not an acceptable domain. Wildcard ports are not allowed." % value
            )

        return
