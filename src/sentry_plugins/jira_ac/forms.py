from django import forms


class JiraConfigForm(forms.Form):
    organization = forms.ChoiceField(
        label="Sentry Organization", choices=tuple(), widget=forms.Select(attrs={"class": "select"})
    )

    def __init__(self, organizations, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["organization"].choices = organizations
