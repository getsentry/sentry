from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.db import IntegrityError
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Team
from sentry.web.frontend.base import TeamView


class EditTeamForm(forms.ModelForm):
    slug = forms.SlugField(
        label=_('Short name'),
        help_text=_('A unique ID used to identify this team.'),
    )

    class Meta:
        fields = ('name', 'slug',)
        model = Team

    def clean_slug(self):
        value = self.cleaned_data.get('slug')
        if not value:
            return

        qs = Team.objects.filter(
            slug=value,
            organization=self.instance.organization,
        ).exclude(id=self.instance.id)
        if qs.exists():
            raise forms.ValidationError("A team with that slug already exists.")

        return value


class TeamSettingsView(TeamView):
    required_scope = 'team:write'

    def get_form(self, request, team):
        return EditTeamForm(request.POST or None, instance=team)

    def handle(self, request, organization, team):
        form = self.get_form(request, team)
        if form.is_valid():
            try:
                team = form.save()
            except IntegrityError:
                form.errors['__all__'] = ['There was an error while saving your changes. Please try again.']

        if form.is_valid():
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

        if request.is_superuser():
            can_remove_team = True
        else:
            can_remove_team = request.access.has_team_scope(team, 'team:delete')

        context = {
            'form': form,
            'can_remove_team': can_remove_team,
        }

        return self.respond('sentry/teams/manage.html', context)
