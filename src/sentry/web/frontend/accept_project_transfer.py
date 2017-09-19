from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.utils.translation import ugettext_lazy as _
from sentry import roles
from sentry.web.frontend.base import BaseView
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, Http404
from django.utils.encoding import force_str
from django.core.signing import BadSignature, SignatureExpired
from sentry.utils.signing import unsign
from sentry.models import AuditLogEntryEvent, OrganizationMember, Organization, Team, Project


class AcceptProjectTransferForm(forms.Form):
    team = forms.ChoiceField(choices=[])

    def __init__(self, request, *args, **kwargs):
        super(AcceptProjectTransferForm, self).__init__(*args, **kwargs)
        teams = []
        for o in OrganizationMember.objects.filter(user__email=request.user):
            org_name = Organization.objects.get(id=o.organization_id).name
            for t in o.get_teams():
                option = " %s - %s" % (t.name, org_name)
                teams.append([t.id, option])

        self.fields['team'].choices = teams
        self.fields['team'].widget.choices = self.fields['team'].choices


class AcceptProjectTransferView(BaseView):
    required_scope = 'org:admin'
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return AcceptProjectTransferForm(request, request.POST, initial=request.POST)
        return AcceptProjectTransferForm(request)

    def handle(self, request, *args, **kwargs):
        try:
            d = request.GET['data']
        except KeyError:
            raise Http404

        try:
            data = unsign(force_str(d))
        except BadSignature:
            messages.add_message(
                request, messages.ERROR,
                _(u'Could not approve transfer, please make sure link is valid.')
            )
            return HttpResponseRedirect(
                reverse('sentry')
            )

        try:
            data = unsign(force_str(d))
        except SignatureExpired:
            messages.add_message(
                request, messages.ERROR,
                _(u'Project transfer link has expired!')
            )
            return HttpResponseRedirect(
                reverse('sentry')
            )

        # from_organization_id = data['from_organization_id']
        project_id = data['project_id']
        user_id = data['user_id']
        transaction_id = data['transaction_id']

        # check if user is still an owner
        if not OrganizationMember.objects.filter(
            role=roles.get_top_dog().id,
            user__is_active=True,
            user_id=user_id,
        ).exists():
            return HttpResponseRedirect(
                reverse('sentry')
            )

        form = self.get_form(request)
        if form.is_valid():
            # transfer the project
            team_id = form.cleaned_data.get('team')
            new_team = Team.objects.get(id=team_id)
            project = Project.objects.get(id=project_id)
            project.team = new_team
            project.organization = new_team.organization
            project.save()

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project_id,
                event=AuditLogEntryEvent.PROJECT_ACCEPT_TRANSFER,
                data=project.get_audit_log_data(),
                transaction_id=transaction_id,
            )

            return HttpResponseRedirect(
                reverse('sentry-organization-home', args=[new_team.organization.slug])
            )

        context = {
            'project': Project.objects.get(id=project_id),
            'form': form,
        }
        return self.respond('sentry/projects/accept_project_transfer.html', context)
