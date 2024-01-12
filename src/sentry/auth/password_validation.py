import logging
from hashlib import sha1

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.utils.functional import lazy
from django.utils.html import format_html
from django.utils.translation import ngettext

from sentry import options
from sentry.utils.imports import import_string

logger = logging.getLogger(__name__)


def get_default_password_validators():
    return get_password_validators(settings.AUTH_PASSWORD_VALIDATORS)


def get_password_validators(validator_config):
    validators = []
    for validator in validator_config:
        try:
            cls = import_string(validator["NAME"])
        except ImportError:
            msg = "The module in NAME could not be imported: %s. Check your AUTH_PASSWORD_VALIDATORS setting."
            raise ImproperlyConfigured(msg % validator["NAME"])
        validators.append(cls(**validator.get("OPTIONS", {})))

    return validators


def validate_password(password, user=None, password_validators=None):
    """
    Validate whether the password meets all validator requirements.

    If the password is valid, return ``None``.
    If the password is invalid, raise ValidationError with all error messages.
    """
    errors = []
    if password_validators is None:
        password_validators = get_default_password_validators()
    for validator in password_validators:
        try:
            validator.validate(password, user=user)
        except ValidationError as error:
            errors.append(error)
    if errors:
        raise ValidationError(errors)


def password_validators_help_texts(password_validators=None):
    """
    Return a list of all help texts of all configured validators.
    """
    help_texts = []
    if password_validators is None:
        password_validators = get_default_password_validators()
    for validator in password_validators:
        help_texts.append(validator.get_help_text())
    return help_texts


def _password_validators_help_text_html(password_validators=None):
    """
    Return an HTML string with all help texts of all configured validators
    in an <ul>.
    """
    help_texts = password_validators_help_texts(password_validators)
    help_items = [format_html("<li>{}</li>", help_text) for help_text in help_texts]
    return "<ul>%s</ul>" % "".join(help_items) if help_items else ""


password_validators_help_text_html = lazy(_password_validators_help_text_html, str)


class MaximumLengthValidator:
    """
    Validate whether the password is of a maximum length.
    """

    def __init__(self, max_length=256):
        self.max_length = max_length

    def validate(self, password, user=None):
        if len(password) > self.max_length:
            raise ValidationError(
                ngettext(
                    "This password is too long. It must contain no more than %(max_length)d character.",
                    "This password is too long. It must contain no more than %(max_length)d characters.",
                    self.max_length,
                ),
                code="password_too_long",
                params={"max_length": self.max_length},
            )

    def get_help_text(self):
        return ngettext(
            "Your password must contain no more than %(max_length)d character.",
            "Your password must contain no more than %(max_length)d characters.",
            self.max_length,
        ) % {"max_length": self.max_length}


class PwnedPasswordsValidator:
    """
    Validate whether a password has previously appeared in a data breach.
    """

    def __init__(self, threshold=1, timeout=0.200):
        self.threshold = threshold
        self.timeout = timeout

    def validate(self, password, user=None):
        digest = sha1(password.encode("utf-8")).hexdigest().upper()
        prefix = digest[:5]
        suffix = digest[5:]

        url = f"https://api.pwnedpasswords.com/range/{prefix}"
        headers = {
            "User-Agent": "Sentry @ {}".format(options.get("system.url-prefix")),
        }

        try:
            r = requests.get(url, headers=headers, timeout=self.timeout)
        except Exception as e:
            logger.warning(
                "Unable to fetch PwnedPasswords API",
                extra={
                    "exception": str(e),
                    "prefix": prefix,
                },
            )
            return

        for line in r.text.split("\n"):
            if ":" not in line:
                continue

            breached_suffix, occurrences = line.rstrip().split(":")
            if breached_suffix == suffix:
                if int(occurrences) >= self.threshold:
                    raise ValidationError(
                        f"This password has previously appeared in data breaches {occurrences} times."
                    )
                break
