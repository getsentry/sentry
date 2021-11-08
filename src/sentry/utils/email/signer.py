from django.core.signing import BadSignature, Signer
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_str, force_text


class _CaseInsensitiveSigner(Signer):  # type: ignore
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

    def signature(self, value: str) -> str:
        # Explicitly typing to satisfy mypy.
        sig: str = super().signature(value)
        return sig.lower()

    def unsign(self, signed_value: str) -> str:
        # This `unsign` is identical to subclass except for the lower-casing
        # See: https://github.com/django/django/blob/1.6.11/django/core/signing.py#L165-L172
        signed_value = force_str(signed_value)
        if self.sep not in signed_value:
            raise BadSignature(f'No "{self.sep}" found in value')
        value, sig = signed_value.rsplit(self.sep, 1)
        if not constant_time_compare(sig.lower(), self.signature(value)):
            raise BadSignature(f'Signature "{sig}" does not match')

        # Explicitly typing to satisfy mypy.
        val: str = force_text(value)
        return val
