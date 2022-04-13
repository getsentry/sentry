from django.conf import settings

from .manager import RoleManager

default_manager = RoleManager(
    settings.SENTRY_ROLES, settings.SENTRY_TEAM_ROLES, settings.SENTRY_DEFAULT_ROLE
)

organization_roles = default_manager.organization_roles
team_roles = default_manager.team_roles
get_minimum_team_role = default_manager.get_minimum_team_role

# Deprecated: Prefer calling methods on organization_roles
can_manage = default_manager.can_manage
get = default_manager.get
get_all = default_manager.get_all
get_choices = default_manager.get_choices
get_default = default_manager.get_default
get_top_dog = default_manager.get_top_dog
with_scope = default_manager.with_scope
with_any_scope = default_manager.with_any_scope
