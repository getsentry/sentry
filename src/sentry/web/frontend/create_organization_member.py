from __future__ import absolute_import

from django import forms
from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.db import transaction, IntegrityError
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.permissions import can_add_organization_member
from sentry.web.forms.fields import UserField
from sentry.web.frontend.base import OrganizationView


class InviteOrganizationMemberForm(forms.ModelForm):
    class Meta:
        fields = ('email',)
        model = OrganizationMember

    def save(self, organization):
        om = super(InviteOrganizationMemberForm, self).save(commit=False)
        om.organization = organization
        om.type = OrganizationMemberType.MEMBER

        sid = transaction.savepoint(using='default')
        try:
            om.save()
        except IntegrityError:
            transaction.savepoint_rollback(sid, using='default')
            return OrganizationMember.objects.get(
                email=om.email,
                organization=organization,
            ), False
        transaction.savepoint_commit(sid, using='default')

        return om, True


class NewOrganizationMemberForm(forms.ModelForm):
    user = UserField()

    class Meta:
        fields = ('user',)
        model = OrganizationMember

    def save(self, organization):
        om = super(NewOrganizationMemberForm, self).save(commit=False)
        om.organization = organization
        om.type = OrganizationMemberType.MEMBER

        sid = transaction.savepoint(using='default')
        try:
            om.save()
        except IntegrityError:
            transaction.savepoint_rollback(sid, using='default')
            return OrganizationMember.objects.get(
                user=om.user,
                organization=organization,
            ), False
        transaction.savepoint_commit(sid, using='default')

        return om, True


class CreateOrganizationMemberView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        initial = {
            'type': OrganizationMemberType.MEMBER,
        }

        if settings.SENTRY_ENABLE_INVITES:
            form_cls = InviteOrganizationMemberForm
        else:
            form_cls = NewOrganizationMemberForm

        return form_cls(request.POST or None, initial=initial)

    def get(self, request, organization):
        if not can_add_organization_member(request.user, organization):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
        }

        return self.respond('sentry/create-organization-member.html', context)

    def post(self, request, organization):
        if not can_add_organization_member(request.user, organization):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)
        if form.is_valid():
            om, created = form.save(organization)

            if created:
                messages.add_message(request, messages.SUCCESS,
                    _('The organization member was added.'))
            else:
                messages.add_message(request, messages.INFO,
                    _('The organization member already exists.'))

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.id, om.id])

            return HttpResponseRedirect(redirect)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
        }

        return self.respond('sentry/create-organization-member.html', context)
