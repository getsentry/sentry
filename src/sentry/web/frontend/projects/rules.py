"""
sentry.web.frontend.projects.rules
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_protect

from sentry.constants import MEMBER_ADMIN
from sentry.models import Rule
from sentry.utils import json
from sentry.rules import rules
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


def _generate_rule_label(project, rule, data):
    rule_cls = rules.get(data['id'])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project, data=data, rule=rule)
    return rule_inst.render_label()


@has_access(MEMBER_ADMIN)
def list_rules(request, organization, project):
    rule_list = []
    for rule in Rule.objects.filter(project=project):
        conditions = []
        for data in rule.data['conditions']:
            conditions.append(_generate_rule_label(project, rule, data))
        conditions = filter(bool, conditions)

        actions = []
        for data in rule.data['actions']:
            actions.append(_generate_rule_label(project, rule, data))
        actions = filter(bool, actions)

        rule_list.append({
            'id': rule.id,
            'label': rule.label,
            'match': rule.data.get('action_match', 'all'),
            'actions': actions,
            'conditions': conditions,
        })

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

    action_list = []
    condition_list = []

    # TODO: conditions need to be based on actions
    for rule_type, rule_cls in rules:
        node = rule_cls(project)
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
