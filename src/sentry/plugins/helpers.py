"""
sentry.plugins.helpers
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.models import ProjectOption, Option, UserOption

__all__ = ('set_option', 'get_option', 'unset_option')


def reset_options(prefix, project=None, user=None):
    if user:
        UserOption.objects.filter(key__startswith='%s:' % (prefix,), project=project, user=user).delete()
        UserOption.objects.clear_cache()
    elif project:
        ProjectOption.objects.filter(key__startswith='%s:' % (prefix,), project=project).delete()
        ProjectOption.objects.clear_cache()
    else:
        Option.objects.filter(key__startswith='%s:' % (prefix,)).delete()
        Option.objects.clear_cache()


def set_option(key, value, project=None, user=None):
    if user:
        result = UserOption.objects.set_value(user, project, key, value)
    elif project:
        result = ProjectOption.objects.set_value(project, key, value)
    else:
        result = Option.objects.set_value(key, value)

    return result


def get_option(key, project=None, user=None):
    if user:
        result = UserOption.objects.get_value(user, project, key, None)
    elif project:
        result = ProjectOption.objects.get_value(project, key, None)
    else:
        result = Option.objects.get_value(key, None)

    return result


def unset_option(key, project=None, user=None):
    if user:
        result = UserOption.objects.unset_value(user, project, key)
    elif project:
        result = ProjectOption.objects.unset_value(project, key)
    else:
        result = Option.objects.unset_value(key)

    return result
