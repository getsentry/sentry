import re

from django.core.validators import URLValidator, _lazy_re_compile


class URLValidatorWithoutDot(URLValidator):
    host_re = (
        "("
        + URLValidator.hostname_re
        + URLValidator.domain_re
        + URLValidator.tld_re
        + "|"
        + URLValidator.hostname_re
        + ")"
    )
    regex = _lazy_re_compile(
        r"^(?:[a-z0-9\.\-\+]*)://"  # scheme is validated separately
        r"(?:\S+(?::\S*)?@)?"  # user:pass authentication
        r"(?:" + URLValidator.ipv4_re + "|" + URLValidator.ipv6_re + "|" + host_re + ")"
        r"(?::\d{2,5})?"  # port
        r"(?:[/?#][^\s]*)?"  # resource path
        r"\Z",
        re.IGNORECASE,
    )
