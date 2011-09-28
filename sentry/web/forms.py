from django import forms

from sentry.models import Project

class EditProjectForm(forms.ModelForm):

    class Meta:
        fields = ('name',)
        model = Project