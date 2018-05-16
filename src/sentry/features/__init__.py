from __future__ import absolute_import

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA

default_manager = FeatureManager()  # NOQA
default_manager.add('auth:register')
default_manager.add('organizations:api-keys', OrganizationFeature)  # NOQA
default_manager.add('organizations:create')
default_manager.add('organizations:sso', OrganizationFeature)  # NOQA
default_manager.add('organizations:sso-saml2', OrganizationFeature)  # NOQA
default_manager.add('organizations:sso-rippling', OrganizationFeature)  # NOQA
default_manager.add('organizations:onboarding', OrganizationFeature)  # NOQA
default_manager.add('organizations:repos', OrganizationFeature)  # NOQA
default_manager.add('organizations:release-commits', OrganizationFeature)  # NOQA
default_manager.add('organizations:suggested-commits', OrganizationFeature)  # NOQA
default_manager.add('organizations:group-unmerge', OrganizationFeature)  # NOQA
default_manager.add('organizations:invite-members', OrganizationFeature)  # NOQA
default_manager.add('organizations:new-settings', OrganizationFeature)  # NOQA
default_manager.add('organizations:integrations-v3', OrganizationFeature)  # NOQA
default_manager.add('organizations:require-2fa', OrganizationFeature)  # NOQA
default_manager.add('organizations:internal-catchall', OrganizationFeature)  # NOQA
default_manager.add('organizations:new-teams', OrganizationFeature)  # NOQA
default_manager.add('organizations:code-owners', OrganizationFeature)  # NOQA
default_manager.add('organizations:unreleased-changes', OrganizationFeature)  # NOQA
default_manager.add('organizations:relay', OrganizationFeature)  # NOQA
default_manager.add('projects:similarity-view', ProjectFeature)  # NOQA
default_manager.add('organizations:environments', OrganizationFeature)  # NOQA
default_manager.add('organizations:dashboard', OrganizationFeature)  # NOQA
default_manager.add('projects:global-events', ProjectFeature)  # NOQA
default_manager.add('projects:plugins', ProjectPluginFeature)  # NOQA
default_manager.add('projects:data-forwarding', ProjectFeature)  # NOQA
default_manager.add('projects:rate-limits', ProjectFeature)  # NOQA
default_manager.add('workflow:release-emails', ProjectFeature)  # NOQA
default_manager.add('projects:sample-events', ProjectFeature)  # NOQA
default_manager.add('projects:servicehooks', ProjectFeature)  # NOQA
default_manager.add('projects:similarity-indexing', ProjectFeature)  # NOQA
default_manager.add('projects:discard-groups', ProjectFeature)  # NOQA
default_manager.add('projects:custom-inbound-filters', ProjectFeature)  # NOQA
default_manager.add('projects:minidump', ProjectFeature)  # NOQA
default_manager.add('user:assistant')
default_manager.add('user:install-experiment')

# expose public api
add = default_manager.add
get = default_manager.get
has = default_manager.has
