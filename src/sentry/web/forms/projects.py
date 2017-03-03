"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.web.forms.fields import RangeField


class DigestSettingsForm(forms.Form):
    minimum_delay = RangeField(
        label=_('Minimum delivery frequency'),
        help_text=_('Notifications will be delivered at most this often.'),
        required=False,
        min_value=1, max_value=60,
    )
    maximum_delay = RangeField(
        label=_('Maximum delivery frequency'),
        help_text=_('Notifications will be delivered at least this often.'),
        required=False,
        min_value=1, max_value=60,
    )

    def clean(self):
        cleaned = super(DigestSettingsForm, self).clean()
        if cleaned['minimum_delay'] > cleaned['maximum_delay']:
            raise forms.ValidationError(_('Maximum delivery frequency must be equal to or greater than the minimum delivery frequency.'))
        return cleaned


class NewRuleForm(forms.Form):
    label = forms.CharField(
        label=_('Label'),
        widget=forms.TextInput(attrs={'placeholder': 'e.g. My Custom Rule'}),
    )
