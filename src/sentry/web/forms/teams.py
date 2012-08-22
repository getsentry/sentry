"""
sentry.web.forms.teams
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms

from sentry.models import Team, TeamMember, PendingTeamMember
from sentry.web.forms.fields import UserField
from django.utils.translation import ugettext_lazy as _


class RemoveTeamForm(forms.Form):
    pass


class NewTeamForm(forms.ModelForm):
    name = forms.CharField(max_length=200, widget=forms.TextInput(attrs={'placeholder': _('e.g. My Team Name')}))
    slug = forms.SlugField(help_text=_('A slug is a URL-safe word and must be unique across all teams.'),
        widget=forms.TextInput(attrs={'placeholder': _('e.g. my-team-name')}))

    class Meta:
        fields = ('name', 'slug')
        model = Team


class NewTeamAdminForm(forms.ModelForm):
    name = forms.CharField(max_length=200, widget=forms.TextInput(attrs={'placeholder': _('e.g. My Team Name')}))
    slug = forms.SlugField(help_text=_('A slug is a URL-safe word and must be unique across all teams.'),
        widget=forms.TextInput(attrs={'placeholder': _('e.g. my-team-name')}))
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'slug', 'owner')
        model = Team


class EditTeamForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Team


class SelectTeamForm(forms.Form):
    team = forms.ChoiceField(choices=())

    def __init__(self, team_list, data, *args, **kwargs):
        super(SelectTeamForm, self).__init__(data=data, *args, **kwargs)
        self.team_list = dict((str(t.pk), t) for t in team_list.itervalues())
        self.fields['team'].choices = [c for c in sorted(self.team_list.iteritems(), key=lambda x: x[1].name)]
        self.fields['team'].choices.insert(0, ('', '-' * 8))
        self.fields['team'].widget.choices = self.fields['team'].choices

    def clean_team(self):
        value = self.cleaned_data.get('team')
        if not value:
            return value
        return self.team_list.get(value)


class BaseTeamMemberForm(forms.ModelForm):
    class Meta:
        fields = ('type',)
        model = TeamMember

    def __init__(self, project, *args, **kwargs):
        self.project = project
        super(BaseTeamMemberForm, self).__init__(*args, **kwargs)


EditTeamMemberForm = BaseTeamMemberForm


class InviteTeamMemberForm(BaseTeamMemberForm):
    class Meta:
        fields = ('type', 'email')
        model = PendingTeamMember

    def clean_email(self):
        value = self.cleaned_data['email']
        if not value:
            return None

        if self.project.member_set.filter(user__email__iexact=value).exists():
            raise forms.ValidationError(_('There is already a member with this email address'))

        if self.project.pending_member_set.filter(email__iexact=value).exists():
            raise forms.ValidationError(_('There is already a pending invite for this user'))

        return value


class NewTeamMemberForm(BaseTeamMemberForm):
    user = UserField()

    class Meta:
        fields = ('type', 'user')
        model = TeamMember

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        if self.project.member_set.filter(user=value).exists():
            raise forms.ValidationError(_('User is already a member of this team'))

        return value
