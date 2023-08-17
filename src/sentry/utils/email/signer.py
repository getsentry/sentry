from __future__ import annotations

from typing import Any

from django.core.signing import BadSignature, Signer
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_str


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

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("algorithm", "sha1")
        super().__init__(*args, **kwargs)

    def signature(self, value: str) -> str:
        return super().signature(value).lower()

    def unsign(self, signed_value: str) -> str:
        # This `unsign` is identical to subclass except for the lower-casing
        # See: https://github.com/django/django/blob/1.6.11/django/core/signing.py#L165-L172
        signed_value = force_str(signed_value)
        if self.sep not in signed_value:
            raise BadSignature(f'No "{self.sep}" found in value')
        value, sig = signed_value.rsplit(self.sep, 1)
        if not constant_time_compare(sig.lower(), self.signature(value)):
            raise BadSignature(f'Signature "{sig}" does not match')

        return force_str(value)
