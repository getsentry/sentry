from __future__ import absolute_import

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA


default_manager = FeatureManager()  # NOQA
default_manager.add('auth:register')
default_manager.add('organizations:api-keys', OrganizationFeature)  # NOQA
default_manager.add('organizations:create')
default_manager.add('organizations:sso', OrganizationFeature)  # NOQA
default_manager.add('organizations:onboarding', OrganizationFeature)  # NOQA
default_manager.add('organizations:callsigns', OrganizationFeature)  # NOQA
default_manager.add('organizations:reports:prepare', OrganizationFeature)  # NOQA
default_manager.add('organizations:reports:deliver', OrganizationFeature)  # NOQA
default_manager.add('organizations:reports:calendar', OrganizationFeature)  # NOQA
default_manager.add('projects:global-events', ProjectFeature)  # NOQA
default_manager.add('projects:quotas', ProjectFeature)  # NOQA
default_manager.add('projects:plugins', ProjectPluginFeature)  # NOQA

# expose public api
add = default_manager.add
get = default_manager.get
has = default_manager.has
