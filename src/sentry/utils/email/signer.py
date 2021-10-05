from django.core.signing import BadSignature, Signer
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_str, force_text


class _CaseInsensitiveSigner(Signer):
    """
    Generate a signature that is comprised of only lowercase letters.

    WARNING: Do not use this for anything that needs to be cryptographically
    secure! This is losing entropy and has a much higher chance of collision
    due to dropping to lowercase letters. For our purposes, this lack of entropy
    is ok and doesn't pose a risk.

    NOTE: This is needed strictly for signatures used in email addresses. Some
    clients (Airmail), treat email addresses as being case-insensitive,
    and sends the value as all lowercase.
    """

    def signature(self, value):
        sig = super().signature(value)
        return sig.lower()

    def unsign(self, signed_value):
        # This `unsign` is identical to subclass except for the lower-casing
        # See: https://github.com/django/django/blob/1.6.11/django/core/signing.py#L165-L172
        signed_value = force_str(signed_value)
        if self.sep not in signed_value:
            raise BadSignature('No "%s" found in value' % self.sep)
        value, sig = signed_value.rsplit(self.sep, 1)
        if constant_time_compare(sig.lower(), self.signature(value)):
            return force_text(value)
        raise BadSignature('Signature "%s" does not match' % sig)
