from __future__ import absolute_import

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA


default_manager = FeatureManager()
default_manager.add('auth:register')
default_manager.add('social-auth:register')
default_manager.add('organizations:create')
default_manager.add('organizations:sso', OrganizationFeature)
default_manager.add('teams:create', OrganizationFeature)

# expose public api
add = default_manager.add
get = default_manager.get
has = default_manager.has
