from rest_framework import serializers

from sentry.utils.http import parse_uri_match


class OriginField(serializers.CharField):
    # Special case origins that don't fit the normal regex pattern, but are valid
    WHITELIST_ORIGINS = "*"

    def to_internal_value(self, data):
        rv = super().to_internal_value(data)
        if not rv:
            return
        self.validate_origin(rv)
        return rv

    def validate_origin(self, value):
        if value in self.WHITELIST_ORIGINS:
            return

        bits = parse_uri_match(value)
        if ":*" in bits.domain:
            raise serializers.ValidationError(
                "%s is not an acceptable domain. Wildcard ports are not allowed." % value
            )

        return
