from __future__ import absolute_import

from rest_framework import serializers

from sentry.web.forms import fields

from django.utils.translation import ugettext_lazy as _


class AllowedEmailField(serializers.EmailField):
    type_name = "AllowedEmailField"
    type_label = "email"
    form_field_class = fields.AllowedEmailField

    default_error_messages = {"invalid": _("Enter a valid email address.")}
    default_validators = fields.AllowedEmailField.default_validators
