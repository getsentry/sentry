from django import forms

from sentry.models import Project


class EditProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Project


class ReplayForm(forms.Form):
    url = forms.URLField()
    method = forms.ChoiceField(choices=((k, k) for k in (
        'POST', 'GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS',
        'CONNECT', 'TRACE',
    )))
    headers = forms.CharField(required=False, widget=forms.Textarea())
    data = forms.CharField(required=False, widget=forms.Textarea())

    def clean_headers(self):
        value = self.cleaned_data.get('headers')
        if not value:
            return

        return dict(line.split(': ') for line in value.split('\n'))
