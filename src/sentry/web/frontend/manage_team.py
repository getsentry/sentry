from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import RESERVED_TEAM_SLUGS
from sentry.models import Team, TeamMember, TeamMemberType
from sentry.permissions import can_remove_team
from sentry.plugins import plugins
from sentry.web.forms.fields import UserField
from sentry.web.frontend.base import TeamView


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


class ManageTeamView(TeamView):
    required_access = TeamMemberType.ADMIN

    def get_default_context(self, request, **kwargs):
        context = super(ManageTeamView, self).get_default_context(request, **kwargs)
        context.update({
            'page': 'details',
            'SUBSECTION': 'settings',
            'can_remove_team': can_remove_team(request.user, kwargs['team']),
        })
        return context

    def get_form(self, request, team):
        can_admin_team = request.user == team.owner or request.user.is_superuser

        if can_admin_team:
            form_cls = EditTeamAdminForm
        else:
            form_cls = EditTeamForm

        return form_cls(request.POST or None, initial={
            'owner': team.owner,
        }, instance=team)

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
        # XXX: form.is_valid() changes the foreignkey
        original_owner = team.owner
        if form.is_valid():

            team = form.save()
            if team.owner != original_owner:
                # Update access for new membership if it's changed
                # (e.g. member used to be USER, but is now OWNER)
                TeamMember.objects.create_or_update(
                    user=team.owner,
                    team=team,
                    defaults={
                        'type': TeamMemberType.ADMIN,
                    }
                )
                team.project_set.update(
                    owner=team.owner,
                )

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your team were saved.'))

            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        context = {
            'form': form,
        }

        return self.respond(team, 'sentry/teams/manage.html', context)
