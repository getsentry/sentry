"""
sentry.web.forms.fields
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.forms.widgets import RadioFieldRenderer, TextInput, Widget
from django.forms.util import flatatt
from django.forms import (
    Field, CharField, IntegerField, TypedChoiceField, ValidationError
)
from django.utils.encoding import force_unicode
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry.models import User


class CustomTypedChoiceField(TypedChoiceField):
    # A patched version of TypedChoiceField which correctly validates a 0
    # as a real input that may be invalid
    # See https://github.com/django/django/pull/3774
    def validate(self, value):
        """
        Validates that the input is in self.choices.
        """
        super(CustomTypedChoiceField, self).validate(value)
        # this will validate itself twice due to the internal ChoiceField
        # validation
        if value is not None and not self.valid_value(value):
            raise ValidationError(
                self.error_messages['invalid_choice'],
                code='invalid_choice',
                params={'value': value},
            )


class RangeInput(TextInput):
    input_type = 'range'


class RadioFieldRenderer(RadioFieldRenderer):
    """
    This is identical to Django's builtin widget, except that
    it renders as a Bootstrap2 compatible widget. Would be great if
    we didn't have to create this stupid code, but Django widgets are not
    flexible.
    """
    def render(self):
        return mark_safe(u'\n<div class="inputs-list">%s</div>\n' % u'\n'.join([force_unicode(w) for w in self]))


class UserField(CharField):
    class widget(TextInput):
        def render(self, name, value, attrs=None):
            if not attrs:
                attrs = {}
            if 'placeholder' not in attrs:
                attrs['placeholder'] = 'username'
            if isinstance(value, six.integer_types):
                value = User.objects.get(id=value).username
            return super(UserField.widget, self).render(name, value, attrs)

    def clean(self, value):
        value = super(UserField, self).clean(value)
        if not value:
            return None
        try:
            return User.objects.get(username=value)
        except User.DoesNotExist:
            raise ValidationError(_('Invalid username'))


class RangeField(IntegerField):
    widget = RangeInput

    def __init__(self, *args, **kwargs):
        self.step_value = kwargs.pop('step_value', None)
        super(RangeField, self).__init__(*args, **kwargs)

    def widget_attrs(self, widget):
        attrs = super(RangeField, self).widget_attrs(widget)
        attrs.setdefault('min', self.min_value)
        attrs.setdefault('max', self.max_value)
        attrs.setdefault('step', self.step_value)
        return attrs


class ReadOnlyTextWidget(Widget):
    def render(self, name, value, attrs):
        final_attrs = self.build_attrs(attrs)
        if not value:
            value = mark_safe("<em>%s</em>" % _("Not set"))
        return format_html("<div{0}>{1}</div>", flatatt(final_attrs), value)


class ReadOnlyTextField(Field):
    widget = ReadOnlyTextWidget

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("required", False)
        super(ReadOnlyTextField, self).__init__(*args, **kwargs)

    def bound_data(self, data, initial):
        # Always return initial because the widget doesn't
        # render an input field.
        return initial
