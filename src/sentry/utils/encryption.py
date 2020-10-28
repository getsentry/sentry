from __future__ import absolute_import

import six

from base64 import b64encode, b64decode
from collections import OrderedDict
from django.conf import settings
from django.utils.encoding import smart_bytes, force_text

MARKER = u"\xef\xbb\xbf"

_marker_length = len(MARKER)


class EncryptionManager(object):
    def __init__(self, schemes=()):
        for key, value in schemes:
            if not isinstance(key, six.string_types):
                raise ValueError(
                    u"Encryption scheme type must be a string. Value was: {!r}".format(value)
                )
            if not hasattr(value, "encrypt") or not hasattr(value, "decrypt"):
                raise ValueError(
                    u"Encryption scheme value must have 'encrypt' and 'decrypt' callables. Value was: {!r}".format(
                        value
                    )
                )
        self.schemes = OrderedDict(schemes)
        if not schemes:
            self.default_scheme = None
        else:
            self.default_scheme = schemes[0][0]

    def encrypt(self, value):
        """Encrypt a text value"""
        if self.default_scheme is None:
            return value
        value = smart_bytes(value)
        scheme = self.schemes[self.default_scheme]
        return u"{}{}${}".format(
            MARKER, self.default_scheme, force_text(b64encode(scheme.encrypt(value)))
        )

    def decrypt(self, value):
        """Decrypts encrypted data into text"""
        # we assume that if encryption is not configured, it was never
        # configured
        if not self.schemes:
            return value
        if not value.startswith(MARKER):
            return value
        try:
            enc_method, enc_data = value[_marker_length:].split("$", 1)
        except (ValueError, IndexError):
            return value
        if not enc_method:
            return value
        enc_data = b64decode(enc_data)
        try:
            scheme = self.schemes[enc_method]
        except KeyError:
            raise ValueError(u"Unknown encryption scheme: {!r}".format(enc_method))
        return force_text(scheme.decrypt(enc_data))


default_manager = EncryptionManager(settings.SENTRY_ENCRYPTION_SCHEMES)

encrypt = default_manager.encrypt
decrypt = default_manager.decrypt
