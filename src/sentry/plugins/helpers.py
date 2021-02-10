from sentry import options
from sentry.models import ProjectOption, UserOption

__all__ = ("set_option", "get_option", "unset_option")


def reset_options(prefix, project=None, user=None):
    if user:
        UserOption.objects.filter(key__startswith=f"{prefix}:", project=project, user=user).delete()
        UserOption.objects.clear_cache()
    elif project:
        ProjectOption.objects.filter(key__startswith=f"{prefix}:", project=project).delete()
        ProjectOption.objects.clear_local_cache()
    else:
        raise NotImplementedError


def set_option(key, value, project=None, user=None):
    if user:
        result = UserOption.objects.set_value(user=user, key=key, value=value, project=project)
    elif project:
        result = ProjectOption.objects.set_value(project, key, value)
    else:
        raise NotImplementedError

    return result


def get_option(key, project=None, user=None):
    if user:
        result = UserOption.objects.get_value(user, key, project=project)
    elif project:
        result = ProjectOption.objects.get_value(project, key, None)
    else:
        result = options.get(key)

    return result


def unset_option(key, project=None, user=None):
    if user:
        result = UserOption.objects.unset_value(user, project, key)
    elif project:
        result = ProjectOption.objects.unset_value(project, key)
    else:
        raise NotImplementedError

    return result
