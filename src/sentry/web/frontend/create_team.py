from __future__ import absolute_import

import logging

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMemberType, Project, Team
)
from sentry.permissions import can_create_teams, Permissions
from sentry.web.frontend.base import OrganizationView
from sentry.web.frontend.generic import missing_perm

BLANK_CHOICE = [("", "")]


class NewTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('E.g. Platform, API, Website, ...'),
            'required': '',
        }),
    )

    class Meta:
        fields = ('name',)
        model = Team

    def save(self, actor, organization, ip_address):
        team = super(NewTeamForm, self).save(commit=False)
        team.organization = organization
        team.owner = organization.owner
        team.save()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=team.id,
            event=AuditLogEntryEvent.TEAM_ADD,
            data=team.get_audit_log_data(),
        )

        return team


class InviteMemberForm(forms.Form):
    def save(self, actor, team, ip_address):
        pass


class NewProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('e.g. Backend'),
            'required': '',
        }),
    )
    platform = forms.ChoiceField(
        choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={
            'data-placeholder': _('Select a platform'),
            'required': '',
        }),
        help_text='Your platform choice helps us setup some defaults for this project.',
    )

    class Meta:
        fields = ('name', 'platform')
        model = Project

    def save(self, actor, team, ip_address):
        project = super(NewProjectForm, self).save(commit=False)
        project.team = team
        project.organization = team.organization
        project.save()

        AuditLogEntry.objects.create(
            organization=project.organization,
            actor=actor,
            ip_address=ip_address,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_ADD,
            data=project.get_audit_log_data(),
        )

        return project


class Step(object):
    def __init__(self, form, template):
        self.form = form
        self.template = template

    def __repr__(self):
        return '<%s: form=%s template=%s>' % (
            type(self).__name__, self.form.__name__, self.template
        )


class CreateTeamView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    session_key = 'ctwizard'

    form_prefix = 'ctwizard'

    steps = [
        Step(form=NewTeamForm, template='create-team-step-0.html'),
        Step(form=InviteMemberForm, template='create-team-step-1.html'),
        Step(form=NewProjectForm, template='create-team-step-2.html'),
    ]

    # A lot of this logic is inspired by Django's FormWizard, but unfortunately
    # using that requires us to inherit from Django's base CBVs which is not
    # acceptable due to the way we handle base view validation and ACLs.
    def handle(self, request, organization):
        if not can_create_teams(request.user, organization):
            return missing_perm(request, Permissions.ADD_TEAM)

        session_data = request.session.get(self.session_key, {})
        if request.method == 'GET':
            logging.debug('GET request; resetting create team form wizard')
            current_step = 0
            try:
                del request.session[self.session_key]
            except KeyError:
                pass
        else:
            current_step = int(request.POST.get('step', 0))

        last_step = len(self.steps) - 1

        if current_step > last_step:
            logging.debug('Invalid step passed; resetting create team form wizard')
            return self.render_validation_error(request, organization)

        op = request.POST.get('op')
        form = self.get_step_form(current_step, request.POST or None)
        if op == 'submit' and form.is_valid():
            session_data['step%d' % current_step] = form.cleaned_data
            request.session[self.session_key] = session_data
            if current_step == last_step:
                # no more steps, render done view
                return self.render_done(request, organization, form)
            else:
                # proceed to the next step
                return self.render_next_step(request, organization, current_step + 1)

        elif op == 'back' and current_step > 0:
            return self.render_next_step(request, organization, current_step - 1)

        elif op == 'skip' and current_step > 1:
            session_data['step%d' % current_step] = {}
            request.session[self.session_key] = session_data
            if current_step == last_step:
                # no more steps, render done view
                return self.render_done(request, organization, form)
            else:
                # proceed to the next step
                return self.render_next_step(request, organization, current_step + 1)

        return self.render(request, organization, current_step, form)

    def get_step_form(self, step, data=None, with_prefix=True):
        if with_prefix:
            prefix = '%s-%d' % (self.form_prefix, step)
        else:
            prefix = None

        return self.steps[step].form(
            data=data,
            prefix=prefix,
        )

    def render(self, request, organization, step, form):
        template = self.steps[step].template
        context = {
            'current_step': step,
            'step': step,
            'form': form,
        }
        return self.respond('sentry/%s' % (template,), context)

    def render_next_step(self, request, organization, step):
        form = self.get_step_form(step)
        return self.render(request, organization, step, form)

    def render_validation_error(self, request, organization):
        try:
            del request.session[self.session_key]
        except KeyError:
            pass

        messages.error(request, 'There was an issue validating your input. Please try again.')

        return self.redirect(request.get_full_path())

    def render_done(self, request, organization, last_form):
        all_forms = []
        session_data = request.session[self.session_key]
        last_index = len(self.steps) - 1
        # revalidate previous steps
        for index in range(len(self.steps)):
            if index == last_index:
                form = last_form
            else:
                form = self.get_step_form(
                    step=index,
                    data=session_data.get('step%d' % (index,), {}),
                    with_prefix=False,
                )

            if not form.is_valid():
                logging.warning('step %d (%s) did not validate; resetting create team wizard',
                              index, type(form).__name__)
                return self.render_validation_error(request, organization)

            all_forms.append(form)

        try:
            return self.save(request, organization, all_forms)
        finally:
            del request.session[self.session_key]

    def save(self, request, organization, all_forms):
        team = all_forms[0].save(request.user, organization, request.META['REMOTE_ADDR'])

        project = all_forms[2].save(request.user, team, request.META['REMOTE_ADDR'])

        if project.platform not in (None, 'other'):
            url = reverse('sentry-docs-client', args=[organization.slug, project.slug, project.platform])
        else:
            url = reverse('sentry-get-started', args=[organization.slug, project.slug])

        return self.redirect(url)
