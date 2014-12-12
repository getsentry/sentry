from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Team, OrganizationMemberType
)
from sentry.permissions import can_remove_team
from sentry.plugins import plugins
from sentry.web.frontend.base import TeamView


class EditTeamForm(forms.ModelForm):
    class Meta:
        fields = ('name', 'slug',)
        model = Team


class TeamSettingsView(TeamView):
    required_access = OrganizationMemberType.ADMIN

    def get_default_context(self, request, **kwargs):
        context = super(TeamSettingsView, self).get_default_context(request, **kwargs)
        context.update({
            'can_remove_team': can_remove_team(request.user, kwargs['team']),
        })
        return context

    def get_form(self, request, team):
        return EditTeamForm(request.POST or None, instance=team)

    def get(self, request, organization, team):
        result = plugins.first('has_perm', request.user, 'edit_team', team)
        if result is False and not request.user.is_superuser:
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, team)

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/manage.html', context)

    def post(self, request, organization, team):
        result = plugins.first('has_perm', request.user, 'edit_team', team)
        if result is False and not request.user.is_superuser:
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, team)
        if form.is_valid():
            team = form.save()

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_EDIT,
                data=team.get_audit_log_data(),
            )

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your team were saved.'))

            return HttpResponseRedirect(reverse('sentry-manage-team', args=[organization.slug, team.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/manage.html', context)
