from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberTeam, OrganizationMemberType, Team
)
from sentry.web.forms.fields import CustomTypedChoiceField

MEMBERSHIP_CHOICES = (
    (OrganizationMemberType.MEMBER, _('Member')),
    (OrganizationMemberType.ADMIN, _('Admin')),
    (OrganizationMemberType.OWNER, _('Owner')),
)


class EditOrganizationMemberForm(forms.ModelForm):
    type = CustomTypedChoiceField(label=_('Membership Type'), choices=(), coerce=int)
    has_global_access = forms.BooleanField(
        label=_('This member should have access to all teams within the organization.'),
        required=False,
    )
    teams = forms.ModelMultipleChoiceField(
        queryset=Team.objects.none(),
        widget=forms.CheckboxSelectMultiple(),
        required=False,
    )

    class Meta:
        fields = ('type', 'has_global_access')
        model = OrganizationMember

    def __init__(self, authorizing_access, *args, **kwargs):
        super(EditOrganizationMemberForm, self).__init__(*args, **kwargs)

        self.fields['type'].choices = [
            m for m in MEMBERSHIP_CHOICES
            if m[0] >= authorizing_access
        ]
        self.fields['teams'].queryset = Team.objects.filter(
            organization=self.instance.organization,
        )

    def save(self, actor, organization, ip_address=None):
        om = super(EditOrganizationMemberForm, self).save()

        for team in self.cleaned_data['teams']:
            OrganizationMemberTeam.objects.create_or_update(
                team=team,
                organizationmember=om,
            )

        OrganizationMemberTeam.objects.filter(
            organizationmember=om,
            is_active=True,
        ).exclude(team__in=self.cleaned_data['teams']).delete()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_EDIT,
            data=om.get_audit_log_data(),
        )

        return om
