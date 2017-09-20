from __future__ import absolute_import

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA

default_manager = FeatureManager()  # NOQA
default_manager.add('auth:register')
default_manager.add('organizations:api-keys', OrganizationFeature)  # NOQA
default_manager.add('organizations:create')
default_manager.add('organizations:sso', OrganizationFeature)  # NOQA
default_manager.add('organizations:saml2', OrganizationFeature)  # NOQA
default_manager.add('organizations:onboarding', OrganizationFeature)  # NOQA
default_manager.add('organizations:callsigns', OrganizationFeature)  # NOQA
default_manager.add('organizations:repos', OrganizationFeature)  # NOQA
default_manager.add('organizations:release-commits', OrganizationFeature)  # NOQA
default_manager.add('organizations:group-unmerge', OrganizationFeature)  # NOQA
default_manager.add('organizations:integrations-v3', OrganizationFeature)  # NOQA
default_manager.add('projects:similarity-view', ProjectFeature)  # NOQA
default_manager.add('projects:global-events', ProjectFeature)  # NOQA
default_manager.add('projects:plugins', ProjectPluginFeature)  # NOQA
default_manager.add('projects:data-forwarding', ProjectFeature)  # NOQA
default_manager.add('projects:rate-limits', ProjectFeature)  # NOQA
default_manager.add('workflow:release-emails', ProjectFeature)  # NOQA
default_manager.add('projects:sample-events', ProjectFeature)  # NOQA
default_manager.add('projects:similarity-indexing', ProjectFeature)  # NOQA
default_manager.add('projects:custom-filters', ProjectFeature)  # NOQA
default_manager.add('projects:custom-inbound-filters', ProjectFeature)  # NOQA
default_manager.add('projects:stream-hit-counts', ProjectFeature)  # NOQA

# expose public api
add = default_manager.add
get = default_manager.get
has = default_manager.has
