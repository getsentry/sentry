"""
sentry.web.forms
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms

from sentry.models import Activity


class NewNoteForm(forms.Form):
    text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': '1',
                                     'placeholder': 'Type a note and press enter...'})
    )

    def save(self, group, user, event=None):
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=user,
            data=self.cleaned_data
        )
        activity.send_notification()

        return activity
