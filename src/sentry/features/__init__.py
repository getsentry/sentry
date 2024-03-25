from sentry.features.permanent import register_permanent_features
from sentry.features.temporary import register_temporary_features

from .base import *  # NOQA
from .handler import *  # NOQA
from .manager import *  # NOQA

# The feature flag system provides a way to turn on or off features of Sentry.
#
# Registering a new feature:
#
# - Determine what scope your feature falls under. By convention we have
#   organization and project scopes, which map to the OrganizationFeature and
#   ProjectFeature feature objects, respectively. Scoping will provide the feature
#   with context.
#
#   Organization and Project scoped features will automatically be added into
#   the Organization and Project serialized representations.
#
#   Additional feature contexts can be found under the features.base module,
#   but you will typically deal with the organization or project.
#
#   NOTE: There is no currently established convention for features which do not
#         fall under these scopes. Use your best judgment for these.
#
# - Set a default for your features.
#
#   Feature defaults are configured in the sentry.conf.server.SENTRY_FEATURES
#   module variable. This is the DEFAULT value for a feature, the default may be
#   overridden by the logic in the exposed feature.manager.FeatureManager
#   instance. See the ``has`` method here for a detailed understanding of how
#   the default values is overridden.
#
# - Use your feature.
#
#   You can check if a feature is enabled using the following call:
#
#   >>> features.has('organization:my-feature', organization, actor=user)
#
#   NOTE: The second parameter is used to provide the feature context, again
#         organization and project are the most common, but it is possible that
#         other Feature objects may require more arguments.
#
#   NOTE: The actor kwarg should be passed when it's expected that the handler
#         needs context of the user.
#
#   NOTE: Features that require Snuba to function, add to the
#         `requires_snuba` tuple.

default_manager = FeatureManager()  # NOQA

register_permanent_features(default_manager)
register_temporary_features(default_manager)

# This is a gross hardcoded list, but there's no
# other sensible way to manage this right now without augmenting
# features themselves in the manager with detections like this.
requires_snuba = (
    "organizations:discover",
    "organizations:global-views",
    "organizations:incidents",
    "organizations:minute-resolution-sessions",
    "organizations:performance-view",
)

# expose public api
add = default_manager.add
entity_features = default_manager.entity_features
get = default_manager.get
has = default_manager.has
batch_has = default_manager.batch_has
all = default_manager.all
add_handler = default_manager.add_handler
add_entity_handler = default_manager.add_entity_handler
has_for_batch = default_manager.has_for_batch
