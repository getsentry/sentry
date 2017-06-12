from __future__ import absolute_import

from django import forms
from sentry.web.frontend.base import BaseView
from sentry.models import OrganizationMember, Organization


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
                return AcceptProjectTransferForm(request, initial=request.POST)
            return AcceptProjectTransferForm(request)

        def handle(self, request, *args, **kwargs):
            # try:
            #     project_id = request.GET['project_id']
            #     to_email = request.GET['to']  # Validate against request.user
            #     from_user_id = request.GET['from_id']
            #     from_org_id = request.GET['from_org']
            # except KeyError:
            #     raise Http404

            form = self.get_form(request)
            context = {
                'form': form,
            }
            return self.respond('sentry/projects/accept_project_transfer.html', context)
