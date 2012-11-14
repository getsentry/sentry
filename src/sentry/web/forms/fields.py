"""
sentry.web.forms.teams
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib.auth.models import User
from django.forms.widgets import RadioFieldRenderer, TextInput
from django.forms import CharField, ValidationError
from django.utils.encoding import force_unicode
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _


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
            if isinstance(value, (int, long)):
                value = User.objects.get(pk=value).username
            return super(UserField.widget, self).render(name, value, attrs)

    def clean(self, value):
        value = super(UserField, self).clean(value)
        if not value:
            return None
        try:
            return User.objects.get(username=value)
        except User.DoesNotExist:
            raise ValidationError(_('Invalid username'))
