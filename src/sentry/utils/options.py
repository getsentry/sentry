""" Helper functions for sentry.options """

import logging

from sentry import options

logger = logging.getLogger(__name__)


def sample_modulo(option_name: str, value: int, granularity: int = 100) -> bool:
    """Deterministically take a sampling decision given an integer value.

    Assumes that

    * `option_name` is a registered option,
    * `(value % granularity)` is uniformly distributed (e.g. org ID, project ID, ...).

    Inspired by https://github.com/getsentry/snuba/blob/28891df3665989ec10e051362dbb84f94aea2f1a/snuba/state/__init__.py#L397-L401
    """
    sample_rate = options.get(option_name)
    try:
        if (value % granularity) < granularity * sample_rate:
            return True
    except TypeError:
        logger.exception("Invalid value for option %r: %r", option_name, sample_rate)

    return False
