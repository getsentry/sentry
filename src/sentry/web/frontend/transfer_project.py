from __future__ import absolute_import

import six
from uuid import uuid4
from six.moves.urllib.parse import urlencode

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry import roles, options
from sentry.web.frontend.base import ProjectView
from sentry.utils.email import MessageBuilder
from sentry.utils.signing import sign
from sentry.models import AuditLogEntryEvent, OrganizationMember, User


class TransferProjectForm(forms.Form):
    email = forms.CharField(
        label=_('Organization Owner'),
        max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('user@company.com')})
    )


class TransferProjectView(ProjectView):
    required_scope = 'project:admin'
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return TransferProjectForm(request.POST)
        return TransferProjectForm()

    def handle(self, request, organization, team, project):
        form = self.get_form(request)

        if form.is_valid():
            email = form.cleaned_data.get('email')
            try:
                owner = User.objects.get(email__iexact=email, is_active=True)
            except User.DoesNotExist:
                messages.add_message(
                    request, messages.ERROR, six.text_type(
                        _('Could not find user')))
                return self.respond('sentry/projects/transfer.html', context={'form': form})

            if OrganizationMember.objects.filter(
                role=roles.get_top_dog().id,
                user=owner,
            ).exists():
                transaction_id = uuid4().hex
                url_data = sign(
                    actor_id=request.user.id,
                    from_organization_id=organization.id,
                    project_id=project.id,
                    user_id=owner.id,
                    transaction_id=transaction_id)
                context = {
                    'email': email,
                    'from_org': organization.name,
                    'project_name': project.name,
                    'request_time': timezone.now(),
                    'url':
                    'dev.getsentry.net:8000/accept-transfer/?' + urlencode({'data': url_data}),
                    'requester': request.user
                }
                MessageBuilder(
                    subject='%sRequest for Project Transfer' %
                    (options.get('mail.subject-prefix'), ),
                    template='sentry/emails/transfer_project.txt',
                    html_template='sentry/emails/transfer_project.html',
                    type='org.confirm_project_transfer_request',
                    context=context,
                ).send_async([email])

                self.create_audit_entry(
                    request=request,
                    organization=project.organization,
                    target_object=project.id,
                    event=AuditLogEntryEvent.PROJECT_REQUEST_TRANSFER,
                    data=project.get_audit_log_data(),
                    transaction_id=transaction_id,
                )

            messages.add_message(
                request, messages.SUCCESS,
                _(u'A request was sent to move project %r to a different organization') %
                (project.name.encode('utf-8'), )
            )

            return HttpResponseRedirect(
                reverse('sentry-organization-home', args=[team.organization.slug])
            )

        context = {
            'form': form,
        }

        return self.respond('sentry/projects/transfer.html', context)
