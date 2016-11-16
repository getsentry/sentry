from __future__ import unicode_literals, absolute_import

from django.conf import settings
from django.core.exceptions import (
    ImproperlyConfigured, ValidationError,
)
from django.utils.functional import lazy
from django.utils.html import format_html
from django.utils.six import text_type
from django.utils.translation import ugettext as _, ungettext

from sentry.utils.imports import import_string


_default_password_validators = None


def get_default_password_validators():
    global _default_password_validators
    if _default_password_validators is None:
        _default_password_validators = get_password_validators(settings.AUTH_PASSWORD_VALIDATORS)
    return _default_password_validators


def get_password_validators(validator_config):
    validators = []
    for validator in validator_config:
        try:
            klass = import_string(validator['NAME'])
        except ImportError:
            msg = "The module in NAME could not be imported: %s. Check your AUTH_PASSWORD_VALIDATORS setting."
            raise ImproperlyConfigured(msg % validator['NAME'])
        validators.append(klass(**validator.get('OPTIONS', {})))

    return validators


def validate_password(password, password_validators=None):
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
            validator.validate(password)
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
    help_items = [format_html('<li>{}</li>', help_text) for help_text in help_texts]
    return '<ul>%s</ul>' % ''.join(help_items) if help_items else ''
password_validators_help_text_html = lazy(_password_validators_help_text_html, text_type)


class MinimumLengthValidator(object):
    """
    Validate whether the password is of a minimum length.
    """
    def __init__(self, min_length=8):
        self.min_length = min_length

    def validate(self, password):
        if len(password) < self.min_length:
            raise ValidationError(
                ungettext(
                    "This password is too short. It must contain at least %(min_length)d character.",
                    "This password is too short. It must contain at least %(min_length)d characters.",
                    self.min_length
                ),
                code='password_too_short',
                params={'min_length': self.min_length},
            )

    def get_help_text(self):
        return ungettext(
            "Your password must contain at least %(min_length)d character.",
            "Your password must contain at least %(min_length)d characters.",
            self.min_length
        ) % {'min_length': self.min_length}


class NumericPasswordValidator(object):
    """
    Validate whether the password is alphanumeric.
    """
    def validate(self, password):
        if password.isdigit():
            raise ValidationError(
                _("This password is entirely numeric."),
                code='password_entirely_numeric',
            )

    def get_help_text(self):
        return _("Your password can't be entirely numeric.")
