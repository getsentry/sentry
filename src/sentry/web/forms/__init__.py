from django import forms

from sentry.models import Activity
from sentry.types.activity import ActivityType


class NewNoteForm(forms.Form):
    text = forms.CharField(
        widget=forms.Textarea(attrs={"rows": "1", "placeholder": "Type a note and press enter..."})
    )

    def save(self, group, user, event=None):
        return Activity.objects.create_group_activity(
            group, ActivityType.NOTE, user=user, data=self.cleaned_data
        )
