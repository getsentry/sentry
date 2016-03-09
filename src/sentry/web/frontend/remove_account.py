from __future__ import absolute_import

import logging

from django import forms
from django.contrib.auth import logout

from sentry import roles
from sentry.api import client
from sentry.models import (
    Organization, OrganizationMember, OrganizationStatus, User
)
from sentry.web.frontend.base import BaseView


class RemoveAccountForm(forms.Form):
    pass


class RemoveAccountView(BaseView):
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return RemoveAccountForm(request.POST)
        return RemoveAccountForm()

    def handle(self, request):
        org_list = Organization.objects.filter(
            member_set__role=roles.get_top_dog().id,
            member_set__user=request.user,
            status=OrganizationStatus.VISIBLE,
        )
        org_results = []
        for org in sorted(org_list, key=lambda x: x.name):
            # O(N) query
            org_results.append({
                'organization': org,
                'single_owner': org.has_single_owner(),
            })

        form = self.get_form(request)
        if form.is_valid():
            avail_org_slugs = set([
                o['organization'].slug for o in org_results
            ])
            orgs_to_remove = set(
                request.POST.getlist('oID')
            ).intersection(avail_org_slugs)
            for result in org_results:
                if result['single_owner']:
                    orgs_to_remove.add(result['organization'].slug)

            logging.getLogger('sentry.deletions').info(
                'User (id=%s) removal requested by self',
                request.user.id)

            for org_slug in orgs_to_remove:
                client.delete('/organizations/{}/'.format(org_slug),
                              request=request, is_sudo=True)

            remaining_org_ids = [
                o.id for o in org_list
                if o.slug in avail_org_slugs.difference(orgs_to_remove)
            ]

            if remaining_org_ids:
                OrganizationMember.objects.filter(
                    organization__in=remaining_org_ids,
                    user=request.user,
                ).delete()

            User.objects.filter(
                id=request.user.id,
            ).update(
                is_active=False,
            )

            logout(request)

            return self.respond('sentry/post-remove-account.html')

        context = {
            'form': form,
            'organization_results': org_results,
        }

        return self.respond('sentry/remove-account.html', context)
