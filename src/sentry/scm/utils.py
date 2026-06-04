import random

from sentry import options


def check_rollout(cohort: float, cutoff: float) -> bool:
    return cutoff > 0 and cohort <= cutoff


def check_rollout_option(option_name: str) -> bool:
    return check_rollout(cohort=random.random(), cutoff=float(options.get(option_name)))
