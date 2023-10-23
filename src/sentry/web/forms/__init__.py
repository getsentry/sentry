from django import forms

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType


class NewNoteForm(forms.Form):
    text = forms.CharField(
        widget=forms.Textarea(attrs={"rows": "1", "placeholder": "Type a note and press enter..."})
    )

    def save(self, group, user):
        qs = Activity.objects.filter(
            group=group,
            project_id=group.project_id,
            user_id=user.id,
            type=ActivityType.NOTE.value,
            data=self.cleaned_data,
        )
        # Prevent duplicate comments, this is necessary for outbox based
        # delivery to be idempotent
        if qs.exists():
            return
        return Activity.objects.create_group_activity(
            group, ActivityType.NOTE, user=user, data=self.cleaned_data
        )
