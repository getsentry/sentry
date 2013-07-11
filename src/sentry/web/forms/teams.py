"""
sentry.web.forms.teams
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_TYPES, RESERVED_TEAM_SLUGS
from sentry.models import Team, TeamMember, PendingTeamMember, AccessGroup, Project
from sentry.web.forms.fields import UserField, get_team_choices


class RemoveTeamForm(forms.Form):
    pass


class NewTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Team Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('example.com')}))

    class Meta:
        fields = ('name',)
        model = Team


class NewTeamAdminForm(NewTeamForm):
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'owner')
        model = Team


class EditTeamForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Team


class EditTeamAdminForm(EditTeamForm):
    owner = UserField(required=True)

    class Meta:
        fields = ('name', 'slug', 'owner',)
        model = Team

    def clean_slug(self):
        value = self.cleaned_data['slug']
        if value in RESERVED_TEAM_SLUGS:
            raise forms.ValidationError('You may not use "%s" as a slug' % (value,))
        return value


class SelectTeamForm(forms.Form):
    team = forms.TypedChoiceField(choices=(), coerce=int)

    def __init__(self, team_list, data, *args, **kwargs):
        super(SelectTeamForm, self).__init__(data=data, *args, **kwargs)
        self.team_list = dict((t.pk, t) for t in team_list.itervalues())
        self.fields['team'].choices = get_team_choices(self.team_list)
        self.fields['team'].widget.choices = self.fields['team'].choices

    def clean_team(self):
        value = self.cleaned_data.get('team')
        if not value or value == -1:
            return None
        return self.team_list.get(value)


class BaseTeamMemberForm(forms.ModelForm):
    class Meta:
        fields = ('type',)
        model = TeamMember

    def __init__(self, team, *args, **kwargs):
        self.team = team
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

        if self.team.member_set.filter(user__email__iexact=value).exists():
            raise forms.ValidationError(_('There is already a member with this email address'))

        if self.team.pending_member_set.filter(email__iexact=value).exists():
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

        if self.team.member_set.filter(user=value).exists():
            raise forms.ValidationError(_('User is already a member of this team'))

        return value


class AcceptInviteForm(forms.Form):
    pass


class BaseAccessGroupForm(forms.ModelForm):
    name = forms.CharField(label=_('Group Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('API Team')}))
    type = forms.ChoiceField(label=_('Access Type'), choices=MEMBER_TYPES,
        help_text=_('Members will gain this level of access to all projects assigned to this group.'))

    class Meta:
        fields = ('name', 'type')
        model = AccessGroup


class NewAccessGroupForm(BaseAccessGroupForm):
    pass


class EditAccessGroupForm(BaseAccessGroupForm):
    pass


class RemoveAccessGroupForm(forms.Form):
    pass


class NewAccessGroupMemberForm(forms.Form):
    user = UserField()


class NewAccessGroupProjectForm(forms.Form):
    project = forms.CharField(label=_('Project'), widget=forms.TextInput(attrs={'placeholder': _('slug')}))

    def __init__(self, group, *args, **kwargs):
        super(NewAccessGroupProjectForm, self).__init__(*args, **kwargs)
        self.group = group

    def clean_project(self):
        value = self.cleaned_data['project']
        try:
            return Project.objects.get(team=self.group.team, slug=value)
        except Project.DoesNotExist:
            raise forms.ValidationError(_('Invalid project slug'))
