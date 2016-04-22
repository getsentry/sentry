from __future__ import absolute_import

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA


default_manager = FeatureManager()
default_manager.add('auth:register')
default_manager.add('organizations:create')
default_manager.add('organizations:sso', OrganizationFeature)
default_manager.add('organizations:onboarding', OrganizationFeature)
default_manager.add('organizations:callsigns', OrganizationFeature)
default_manager.add('projects:breadcrumbs', ProjectFeature)
default_manager.add('projects:global-events', ProjectFeature)
default_manager.add('projects:quotas', ProjectFeature)
default_manager.add('projects:plugins', ProjectPluginFeature)


# expose public api
add = default_manager.add
get = default_manager.get
has = default_manager.has
