import warnings

warnings.warn("The use of 'sentry.routers' is deprecated. Please use 'sentry.utils.router' instead.", DeprecationWarning)

from sentry.utils.router import *
