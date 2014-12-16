"""
sentry.web.frontend.projects.rules
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import re

from collections import defaultdict
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_protect

from sentry.constants import MEMBER_ADMIN
from sentry.models import Rule
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.rules import rules
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


class RuleFormValidator(object):
    # XXX(dcramer): please no judgements on any of the rule code, I realize it's
    # all terrible and poorly described
    def __init__(self, project, data=None):
        self.project = project
        self.data = data
        self.errors = {}

    @memoize
    def cleaned_data(self):
        # parse out rules
        rules_by_id = {
            'actions': {},
            'conditions': {},
        }
        # TODO: conditions need to be based on actions
        for rule_type, rule in rules:
            if rule_type.startswith('condition/'):
                rules_by_id['conditions'][rule.id] = rule
            elif rule_type.startswith('action/'):
                rules_by_id['actions'][rule.id] = rule

        key_regexp = r'^(condition|action)\[(\d+)\]\[(.+)\]$'
        raw_data = defaultdict(lambda: defaultdict(dict))
        for key, value in self.data.iteritems():
            match = re.match(key_regexp, key)
            if not match:
                continue
            raw_data[match.group(1)][match.group(2)][match.group(3)] = value

        data = {
            'label': self.data.get('label', '').strip(),
            'action_match': self.data.get('action_match', 'all'),
            'actions': [],
            'conditions': [],
        }

        for num, node in sorted(raw_data['condition'].iteritems()):
            data['conditions'].append(node)
            cls = rules_by_id['conditions'][node['id']]
            if not cls(self.project, node).validate_form():
                self.errors['condition[%s]' % (num,)] = 'Ensure all fields are filled out correctly.'

        for num, node in sorted(raw_data['action'].iteritems()):
            data['actions'].append(node)
            cls = rules_by_id['actions'][node['id']]
            if not cls(self.project, node).validate_form():
                self.errors['action[%s]' % (num,)] = 'Ensure all fields are filled out correctly.'

        if not data['label'] or len(data['label']) > 64:
            self.errors['label'] = 'Value must be less than 64 characters.'

        return data

    def is_valid(self):
        # force validation
        self.cleaned_data
        return not bool(self.errors)


@has_access(MEMBER_ADMIN)
def list_rules(request, organization, project):
    rule_list = Rule.objects.filter(project=project)

    context = csrf(request)
    context.update({
        'organization': organization,
        'team': project.team,
        'page': 'rules',
        'project': project,
        'rule_list': rule_list,
    })

    return render_to_response('sentry/projects/rules/list.html', context, request)


@has_access(MEMBER_ADMIN)
@csrf_protect
def create_or_edit_rule(request, organization, project, rule_id=None):
    if rule_id:
        try:
            rule = Rule.objects.get(project=project, id=rule_id)
        except Rule.DoesNotExist:
            path = reverse('sentry-project-rules', args=[organization.slug, project.slug])
            return HttpResponseRedirect(path)
    else:
        rule = Rule(project=project)

    form_data = {
        'label': rule.label,
        'action_match': rule.data.get('action_match'),
    }

    if request.POST:
        for key, value in request.POST.iteritems():
            form_data[key] = value
    else:
        for num, node in enumerate(rule.data.get('conditions', [])):
            prefix = 'condition[%d]' % (num,)
            for key, value in node.iteritems():
                form_data[prefix + '[' + key + ']'] = value

        for num, node in enumerate(rule.data.get('actions', [])):
            prefix = 'action[%d]' % (num,)
            for key, value in node.iteritems():
                form_data[prefix + '[' + key + ']'] = value

    validator = RuleFormValidator(project, form_data)
    if request.POST and validator.is_valid():
        data = validator.cleaned_data.copy()

        rule.label = data.pop('label')
        rule.data = data
        rule.save()

        messages.add_message(
            request, messages.SUCCESS,
            _('Changes to your rule were saved.'))

        path = reverse('sentry-project-rules', args=[organization.slug, project.slug])
        return HttpResponseRedirect(path)

    action_list = []
    condition_list = []

    # TODO: conditions need to be based on actions
    for rule_type, rule in rules:
        node = rule(project)
        context = {
            'id': node.id,
            'label': node.label,
            'html': node.render_form(),
        }

        if rule_type.startswith('condition/'):
            condition_list.append(context)
        elif rule_type.startswith('action/'):
            action_list.append(context)

    context = csrf(request)
    context.update({
        'rule': rule,
        'form_is_valid': (not request.POST or validator.is_valid()),
        'form_errors': validator.errors,
        'form_data': form_data,
        'organization': organization,
        'team': project.team,
        'page': 'rules',
        'action_list': json.dumps(action_list),
        'condition_list': json.dumps(condition_list),
        'project': project,
    })

    return render_to_response('sentry/projects/rules/new.html', context, request)


@has_access(MEMBER_ADMIN)
@csrf_protect
def remove_rule(request, organization, project, rule_id):
    path = reverse('sentry-project-rules', args=[organization.slug, project.slug])

    try:
        rule = Rule.objects.get(project=project, id=rule_id)
    except Rule.DoesNotExist:
        return HttpResponseRedirect(path)

    rule.delete()

    messages.add_message(request, messages.SUCCESS,
        _('The rule was removed.'))

    return HttpResponseRedirect(path)
