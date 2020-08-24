from __future__ import absolute_import

import re
from django.core.validators import _lazy_re_compile, EmailValidator
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers

from sentry.web.forms import fields


class AllowedEmailField(serializers.EmailField):
    type_name = "AllowedEmailField"
    type_label = "email"
    form_field_class = fields.AllowedEmailField

    default_error_messages = {"invalid": _("Enter a valid email address.")}
    default_validators = fields.AllowedEmailField.default_validators


class CommitAuthorValidator(EmailValidator):
    """
    Github's Dependabot forces square brackets into the local-part in the commit's author email.
    """

    user_regex = _lazy_re_compile(
        r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z\[\]]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*\Z"  # dot-atom
        r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-\011\013\014\016-\177])*"\Z)',  # quoted-string
        re.IGNORECASE,
    )
