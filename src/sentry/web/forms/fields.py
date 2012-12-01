"""
sentry.web.forms.teams
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib.auth.models import User
from django.core.validators import URLValidator
from django.forms.widgets import RadioFieldRenderer, TextInput, Textarea
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


class OriginsField(CharField):
    _url_validator = URLValidator(verify_exists=False)
    widget = Textarea(attrs={'placeholder': 'e.g. http://example.com\n*.example.com', 'class': 'span8'})

    def clean(self, value):
        if not value:
            return []
        values = filter(bool, (v.strip() for v in value.split('\n')))
        for value in values:
            if not self.is_valid_origin(value):
                raise ValidationError('%r is not an acceptable origin' % value)
        return values

    def is_valid_origin(self, value):
        if value == '*':
            return True

        if '://' in value:
            # URLValidator will raise a forms.ValidationError itself
            self._url_validator(value)
            return True

        # ports are not supported on matching expressions (yet)
        if ':' in value:
            return False

        # no .com's
        parts = filter(bool, value.split('.'))
        if len(parts) < 2:
            return False

        return True
