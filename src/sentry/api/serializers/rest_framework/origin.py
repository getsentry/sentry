from __future__ import absolute_import

from rest_framework import serializers

from sentry.utils.http import parse_uri_match


class OriginField(serializers.CharField):
    # Special case origins that don't fit the normal regex pattern, but are valid
    WHITELIST_ORIGINS = ('*')

    def from_native(self, data):
        rv = super(OriginField, self).from_native(data)
        if not rv:
            return
        if not self.is_valid_origin(rv):
            raise serializers.ValidationError('%s is not an acceptable domain' % rv)
        return rv

    def is_valid_origin(self, value):
        if value in self.WHITELIST_ORIGINS:
            return True

        bits = parse_uri_match(value)
        # ports are not supported on matching expressions (yet)
        if ':' in bits.domain:
            return False

        return True
