"""
sentry.web.forms.projectkeys
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms

from sentry.models import ProjectKey


class EditProjectKeyForm(forms.ModelForm):
    class Meta:
        fields = ('label',)
        model = ProjectKey
