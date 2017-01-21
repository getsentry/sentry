from __future__ import absolute_import

from django.db import transaction
from django.http import Http404, HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator

from sentry.models import Group, GroupSubscription, OrganizationMember
from sentry.web.decorators import signed_auth_required
from sentry.web.frontend.base import BaseView
from sentry.utils.http import absolute_uri

signed_auth_required_m = method_decorator(signed_auth_required)


class UnsubscribeIssueNotificationsView(BaseView):
    auth_required = False

    @never_cache
    @signed_auth_required_m
    @transaction.atomic
    def handle(self, request, issue_id):
        if not getattr(request, 'user_from_signed_request', False):
            raise Http404

        try:
            group = Group.objects.get_from_cache(id=issue_id)
        except Group.DoesNotExist:
            raise Http404

        if not OrganizationMember.objects.filter(
            user=request.user,
            organization=group.project.organization,
        ).exists():
            raise Http404

        issue_link = absolute_uri('/{}/{}/issues/{}/'.format(
            group.project.organization.slug,
            group.project.slug,
            group.id,
        ))

        if request.method == 'POST':
            if request.POST.get('op') == 'unsubscribe':
                GroupSubscription.objects.create_or_update(
                    group=group,
                    project=group.project,
                    user=request.user,
                    is_active=False,
                )
            return HttpResponseRedirect(issue_link)

        return self.respond('sentry/unsubscribe-issue-notifications.html', {
            'issue': group,
            'issue_link': issue_link
        })
