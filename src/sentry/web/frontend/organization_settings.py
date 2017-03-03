from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry import roles
from sentry.models import AuditLogEntryEvent, Organization
from sentry.web.frontend.base import OrganizationView


class OrganizationSettingsForm(forms.ModelForm):
    name = forms.CharField(help_text=_('The name of your organization. i.e. My Company'))
    slug = forms.SlugField(
        label=_('Short name'),
        help_text=_('A unique ID used to identify this organization.'),
    )
    allow_joinleave = forms.BooleanField(
        label=_('Open Membership'),
        help_text=_('Allow organization members to freely join or leave any team.'),
        required=False,
    )
    default_role = forms.ChoiceField(
        label=_('Default Role'),
        choices=roles.get_choices(),
        help_text=_('The default role new members will receive.'),
    )
    enhanced_privacy = forms.BooleanField(
        label=_('Enhanced Privacy'),
        help_text=_('Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.'),
        required=False,
    )
    allow_shared_issues = forms.BooleanField(
        label=_('Allow Shared Issues'),
        help_text=_('Enable sharing of limited details on issues to anonymous users.'),
        required=False,
    )
    require_scrub_data = forms.BooleanField(
        label=_('Require Data Scrubber'),
        help_text=_('Require server-side data scrubbing be enabled for all projects.'),
        required=False
    )
    require_scrub_defaults = forms.BooleanField(
        label=_('Require Using Default Scrubbers'),
        help_text=_('Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects.'),
        required=False
    )
    sensitive_fields = forms.CharField(
        label=_('Global additional sensitive fields'),
        help_text=_('Additional field names to match against when scrubbing data for all projects. '
                    'Separate multiple entries with a newline.<br /><strong>Note: These fields will be used in addition to project specific fields.</strong>'),
        widget=forms.Textarea(attrs={
            'placeholder': mark_safe(_('e.g. email')),
            'class': 'span8',
            'rows': '3',
        }),
        required=False,
    )
    safe_fields = forms.CharField(
        label=_('Global safe fields'),
        help_text=_('Field names which data scrubbers should ignore. '
                    'Separate multiple entries with a newline.<br /><strong>Note: These fields will be used in addition to project specific fields.</strong>'),
        widget=forms.Textarea(attrs={
            'placeholder': mark_safe(_('e.g. email')),
            'class': 'span8',
            'rows': '3',
        }),
        required=False,
    )
    require_scrub_ip_address = forms.BooleanField(
        label=_('Prevent Storing of IP Addresses'),
        help_text=_('Preventing IP addresses from being stored for new events on all projects.'),
        required=False
    )
    early_adopter = forms.BooleanField(
        label=_('Early Adopter'),
        help_text=_('Opt-in to new features before they\'re released to the public.'),
        required=False
    )

    class Meta:
        fields = ('name', 'slug', 'default_role')
        model = Organization

    def __init__(self, has_delete, *args, **kwargs):
        super(OrganizationSettingsForm, self).__init__(*args, **kwargs)
        if not has_delete:
            del self.fields['default_role']

    def clean_sensitive_fields(self):
        value = self.cleaned_data.get('sensitive_fields')
        if not value:
            return

        return filter(bool, (v.lower().strip() for v in value.split('\n')))

    def clean_safe_fields(self):
        value = self.cleaned_data.get('safe_fields')
        if not value:
            return

        return filter(bool, (v.lower().strip() for v in value.split('\n')))


class OrganizationSettingsView(OrganizationView):
    required_scope = 'org:write'

    def get_form(self, request, organization):
        has_delete = request.access.has_scope('org:delete')

        return OrganizationSettingsForm(
            has_delete=has_delete,
            data=request.POST or None,
            instance=organization,
            initial={
                'default_role': organization.default_role,
                'allow_joinleave': bool(organization.flags.allow_joinleave),
                'enhanced_privacy': bool(organization.flags.enhanced_privacy),
                'allow_shared_issues': bool(not organization.flags.disable_shared_issues),
                'require_scrub_data': bool(organization.get_option('sentry:require_scrub_data', False)),
                'require_scrub_defaults': bool(organization.get_option('sentry:require_scrub_defaults', False)),
                'sensitive_fields': '\n'.join(organization.get_option('sentry:sensitive_fields', None) or []),
                'safe_fields': '\n'.join(organization.get_option('sentry:safe_fields', None) or []),
                'require_scrub_ip_address': bool(organization.get_option('sentry:require_scrub_ip_address', False)),
                'early_adopter': bool(organization.flags.early_adopter),
            }
        )

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            organization = form.save(commit=False)
            organization.flags.allow_joinleave = form.cleaned_data['allow_joinleave']
            organization.flags.enhanced_privacy = form.cleaned_data['enhanced_privacy']
            organization.flags.disable_shared_issues = not form.cleaned_data['allow_shared_issues']
            organization.flags.early_adopter = form.cleaned_data['early_adopter']
            organization.save()

            for opt in (
                    'require_scrub_data',
                    'require_scrub_defaults',
                    'sensitive_fields',
                    'safe_fields',
                    'require_scrub_ip_address'):
                value = form.cleaned_data.get(opt)
                if value is None:
                    organization.delete_option('sentry:%s' % (opt,))
                else:
                    organization.update_option('sentry:%s' % (opt,), value)

            self.create_audit_entry(
                request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_EDIT,
                data=organization.get_audit_log_data(),
            )

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your organization were saved.'))

            return HttpResponseRedirect(reverse('sentry-organization-settings', args=[organization.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/organization-settings.html', context)
