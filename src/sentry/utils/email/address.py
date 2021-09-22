from email.utils import parseaddr

from django.conf import settings
from django.utils.encoding import force_bytes

from sentry import options

from .signer import _CaseInsensitiveSigner

# cache the domain_from_email calculation
# This is just a tuple of (email, email-domain)
_from_email_domain_cache = (None, None)


signer = _CaseInsensitiveSigner()


def get_from_email_domain():
    global _from_email_domain_cache
    from_ = options.get("mail.from")
    if not _from_email_domain_cache[0] == from_:
        _from_email_domain_cache = (from_, domain_from_email(from_))
    return _from_email_domain_cache[1]


def email_to_group_id(address):
    """
    Email address should be in the form of:
        {group_id}+{signature}@example.com
    """
    address = address.split("@", 1)[0]
    signed_data = address.replace("+", ":")
    return int(force_bytes(signer.unsign(signed_data)))


def group_id_to_email(group_id):
    signed_data = signer.sign(str(group_id))
    return "@".join(
        (
            signed_data.replace(":", "+"),
            options.get("mail.reply-hostname") or get_from_email_domain(),
        )
    )


def domain_from_email(email):
    email = parseaddr(email)[1]
    try:
        return email.split("@", 1)[1]
    except IndexError:
        # The email address is likely malformed or something
        return email


def is_valid_email_address(value: str) -> bool:
    return not settings.INVALID_EMAIL_ADDRESS_PATTERN.search(value)
