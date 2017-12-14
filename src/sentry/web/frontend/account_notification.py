from __future__ import absolute_import

import itertools

from django.contrib import messages
from django.core.context_processors import csrf
from django.db import transaction
from django.http import HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator

from sudo.decorators import sudo_required

from sentry.models import (Project, ProjectStatus, Organization, OrganizationStatus)
from sentry.plugins import plugins
from sentry.web.forms.accounts import (
    ProjectEmailOptionsForm, NotificationSettingsForm, NotificationReportSettingsForm,
    NotificationDeploySettingsForm
)
from sentry.web.decorators import login_required
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response
from sentry.utils.auth import get_auth_providers
from sentry.utils.safe import safe_execute


class AccountNotificationView(BaseView):
    notification_settings_form = NotificationSettingsForm

    @method_decorator(never_cache)
    @method_decorator(login_required)
    @method_decorator(sudo_required)
    @method_decorator(transaction.atomic)
    def handle(self, request):
        settings_form = self.notification_settings_form(request.user, request.POST or None)
        reports_form = NotificationReportSettingsForm(
            request.user, request.POST or None, prefix='reports'
        )

        org_list = list(
            Organization.objects.filter(
                status=OrganizationStatus.VISIBLE,
                member_set__user=request.user,
            ).distinct()
        )

        org_forms = [
            (
                org, NotificationDeploySettingsForm(
                    request.user, org, request.POST or None, prefix='deploys-org-%s' % (org.id, )
                )
            ) for org in sorted(org_list, key=lambda o: o.name)
        ]

        project_list = list(
            Project.objects.filter(
                teams__organizationmemberteam__organizationmember__user=request.user,
                teams__organizationmemberteam__is_active=True,
                status=ProjectStatus.VISIBLE,
            ).distinct()
        )

        project_forms = [
            (
                project, ProjectEmailOptionsForm(
                    project,
                    request.user,
                    request.POST or None,
                    prefix='project-%s' % (project.id, )
                )
            ) for project in sorted(project_list, key=lambda x: (x.organization.name, x.name))
        ]

        ext_forms = []
        for plugin in plugins.all():
            for form in safe_execute(plugin.get_notification_forms, _with_transaction=False) or ():
                form = safe_execute(
                    form,
                    plugin,
                    request.user,
                    request.POST or None,
                    prefix=plugin.slug,
                    _with_transaction=False
                )
                if not form:
                    continue
                ext_forms.append(form)

        if request.POST:
            all_forms = list(
                itertools.chain(
                    [settings_form, reports_form], ext_forms, (f for _, f in project_forms),
                    (f for _, f in org_forms)
                )
            )
            if all(f.is_valid() for f in all_forms):
                for form in all_forms:
                    form.save()
                messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
                return HttpResponseRedirect(request.path)

        context = csrf(request)
        context.update(
            {
                'settings_form': settings_form,
                'project_forms': project_forms,
                'org_forms': org_forms,
                'reports_form': reports_form,
                'ext_forms': ext_forms,
                'page': 'notifications',
                'AUTH_PROVIDERS': get_auth_providers(),
            }
        )
        return render_to_response('sentry/account/notifications.html', context, request)
