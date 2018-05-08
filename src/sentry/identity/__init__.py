from __future__ import absolute_import

from .base import *  # NOQA
from .manager import IdentityManager  # NOQA
from .oauth2 import *  # NOQA
from .jwt import *  # NOQA

from .slack import *  # NOQA
from .github import *  # NOQA
from .vsts import *  # NOQA
from .bitbucket import *  # NOQA


default_manager = IdentityManager()
all = default_manager.all
get = default_manager.get
exists = default_manager.exists
register = default_manager.register
unregister = default_manager.unregister

# TODO(epurkhiser): Should this be moved into it's own plugin, it should be
# initialized there.
register(SlackIdentityProvider)  # NOQA
register(GitHubIdentityProvider)  # NOQA
register(VSTSIdentityProvider)  # NOQA
register(BitBucketIdentityProvider)  # NOQA
