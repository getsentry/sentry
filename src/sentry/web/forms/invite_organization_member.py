from __future__ import absolute_import

from django import forms
from django.db import transaction, IntegrityError

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)
from sentry.signals import member_invited


class InviteOrganizationMemberForm(forms.ModelForm):
    # override this to ensure the field is required
    email = forms.EmailField()

    teams = forms.ModelMultipleChoiceField(
        queryset=Team.objects.none(),
        widget=forms.CheckboxSelectMultiple(),
        required=False,
    )
    role = forms.ChoiceField()

    class Meta:
        fields = ('email',)
        model = OrganizationMember

    def __init__(self, *args, **kwargs):
        allowed_roles = kwargs.pop('allowed_roles')
        all_teams = kwargs.pop('all_teams')

        super(InviteOrganizationMemberForm, self).__init__(*args, **kwargs)

        self.fields['role'].choices = (
            (r.id, r.name)
            for r in allowed_roles
        )

        self.fields['teams'].queryset = all_teams

    def save(self, actor, organization, ip_address):
        om = super(InviteOrganizationMemberForm, self).save(commit=False)
        om.organization = organization
        om.token = om.generate_token()

        try:
            existing = OrganizationMember.objects.filter(
                organization=organization,
                user__email__iexact=om.email,
                user__is_active=True,
            )[0]
        except IndexError:
            pass
        else:
            return existing, False

        sid = transaction.savepoint(using='default')
        try:
            om.save()
        except IntegrityError:
            transaction.savepoint_rollback(sid, using='default')
            return OrganizationMember.objects.get(
                email__iexact=om.email,
                organization=organization,
            ), False
        transaction.savepoint_commit(sid, using='default')

        for team in self.cleaned_data['teams']:
            OrganizationMemberTeam.objects.create_or_update(
                team=team,
                organizationmember=om,
            )

        OrganizationMemberTeam.objects.filter(
            organizationmember=om,
        ).exclude(team__in=self.cleaned_data['teams']).delete()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            event=AuditLogEntryEvent.MEMBER_INVITE,
            data=om.get_audit_log_data(),
        )
        member_invited.send(member=om, user=actor, sender=InviteOrganizationMemberForm)
        om.send_invite_email()

        return om, True
