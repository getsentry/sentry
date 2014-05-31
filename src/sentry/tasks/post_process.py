"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.conf import settings
from hashlib import md5

from sentry.plugins import plugins
from sentry.rules import rules
from sentry.tasks.base import instrumented_task
from sentry.utils.cache import cache
from sentry.utils.safe import safe_execute


rules_logger = logging.getLogger('sentry.errors.rules')


def condition_matches(project, condition, **kwargs):
    condition_cls = rules.get(condition['id'])
    if condition_cls is None:
        rules_logger.error('Unregistered condition %r', condition['id'])
        return

    condition_inst = condition_cls(project)
    return safe_execute(condition_inst.passes, **kwargs)


def get_rules(project):
    from sentry.models import Rule

    cache_key = 'project:%d:rules' % (project.id,)
    rules_list = cache.get(cache_key)
    if rules_list is None:
        rules_list = list(Rule.objects.filter(project=project))
        cache.set(cache_key, rules_list, 60)
    return rules_list


@instrumented_task(
    name='sentry.tasks.post_process.post_process_group',
    queue='triggers')
def post_process_group(group, event, is_new, is_regression, is_sample, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    from sentry.models import Project

    project = Project.objects.get_from_cache(id=group.project_id)

    child_kwargs = {
        'event': event,
        'is_new': is_new,
        'is_regression': is_regression,
        'is_sample': is_sample,
    }

    if settings.SENTRY_ENABLE_EXPLORE_CODE:
        record_affected_code.delay(group=group, event=event)

    if settings.SENTRY_ENABLE_EXPLORE_USERS:
        record_affected_user.delay(group=group, event=event)

    for plugin in plugins.for_project(project):
        plugin_post_process_group.delay(
            plugin.slug, group=group, **child_kwargs)

    for rule in get_rules(project):
        match = rule.data.get('action_match', 'all')
        condition_list = rule.data.get('conditions', ())
        if not condition_list:
            pass
        elif match == 'all':
            if not all(condition_matches(project, c, **child_kwargs) for c in condition_list):
                continue
        elif match == 'any':
            if not any(condition_matches(project, c, **child_kwargs) for c in condition_list):
                continue
        elif match == 'none':
            if any(condition_matches(project, c, **child_kwargs) for c in condition_list):
                continue
        else:
            rules_logger.error('Unsupported action_match %r for rule %d',
                               match, rule.id)
            continue

        execute_rule.delay(
            rule_id=rule.id,
            **child_kwargs
        )


@instrumented_task(
    name='sentry.tasks.post_process.execute_rule',
    queue='triggers')
def execute_rule(rule_id, event, **kwargs):
    """
    Fires post processing hooks for a rule.
    """
    from sentry.models import Project, Rule

    rule = Rule.objects.get(id=rule_id)
    project = Project.objects.get_from_cache(id=event.project_id)
    event.project = project
    event.group.project = project

    for action in rule.data.get('actions', ()):
        action_cls = rules.get(action['id'])
        if action_cls is None:
            rules_logger.error('Unregistered action %r', action['id'])
            continue

        action_inst = action_cls(project)
        safe_execute(action_inst.after, event=event, **kwargs)


@instrumented_task(
    name='sentry.tasks.post_process.plugin_post_process_group',
    queue='triggers',
    stat_suffix=lambda plugin_slug, *a, **k: plugin_slug)
def plugin_post_process_group(plugin_slug, group, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, group=group, **kwargs)


@instrumented_task(
    name='sentry.tasks.post_process.record_affected_user',
    queue='triggers')
def record_affected_user(group, event, **kwargs):
    from sentry.models import Group

    if not settings.SENTRY_ENABLE_EXPLORE_USERS:
        return

    user_ident = event.user_ident
    if not user_ident:
        return

    user_data = event.data.get('sentry.interfaces.User', {})

    Group.objects.add_tags(group, [
        ('sentry:user', user_ident, {
            'id': user_data.get('id'),
            'email': user_data.get('email'),
            'username': user_data.get('username'),
            'data': user_data.get('data'),
            'ip': event.ip_address,
        })
    ])


@instrumented_task(
    name='sentry.tasks.post_process.record_affected_code',
    queue='triggers')
def record_affected_code(group, event, **kwargs):
    from sentry.models import Group

    if not settings.SENTRY_ENABLE_EXPLORE_CODE:
        return

    data = event.interfaces.get('sentry.interfaces.Exception')
    if not data:
        return

    checksum = lambda x: md5(x).hexdigest()

    tags = []
    for exception in data:
        if not exception.stacktrace:
            continue

        for frame in exception.stacktrace:
            # we only tag explicit app frames to avoid excess fat
            if not frame.in_app:
                continue

            filename = frame.filename or frame.module
            if not filename:
                continue

            tags.append((
                'sentry:filename',
                checksum(filename),
                {'filename': filename},
            ))

            function = frame.function
            if function:
                tags.append((
                    'sentry:function',
                    checksum('%s:%s' % (filename, function)),
                    {'filename': filename, 'function': function}
                ))

    if tags:
        Group.objects.add_tags(group, tags)
