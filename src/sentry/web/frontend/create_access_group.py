from __future__ import absolute_import

from django import forms
from sentry.constants import MEMBER_TYPES, MEMBER_USER
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import TeamMemberType, AccessGroup
from sentry.web.frontend.base import TeamView


class NewAccessGroupForm(forms.ModelForm):
    name = forms.CharField(label=_('Group Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('API Team')}))
    type = forms.ChoiceField(label=_('Access Type'), choices=MEMBER_TYPES,
        help_text=_('Members will gain this level of access to all projects assigned to this group.'))

    class Meta:
        fields = ('name', 'type')
        model = AccessGroup


class CreateAccessGroupView(TeamView):
    required_access = TeamMemberType.ADMIN

    def get_form(self, request):
        initial = {
            'type': MEMBER_USER,
        }

        return NewAccessGroupForm(request.POST or None, initial=initial)

    def get(self, request, organization, team):
        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/groups/new.html', context)

    def post(self, request, organization, team):
        form = self.get_form(request)
        if form.is_valid():
            inst = form.save(commit=False)
            inst.team = team
            inst.managed = False
            inst.save()
            return HttpResponseRedirect(reverse('sentry-manage-access-groups', args=[team.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/groups/new.html', context)
