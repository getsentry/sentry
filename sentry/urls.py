import warnings

warnings.warn("The use of 'sentry.urls' is deprecated. Please use 'sentry.web.urls' instead.", DeprecationWarning)

from sentry.web.urls import *
