from sentry.search.events import constants


def user_misery_formula(miserable_users: int, unique_users: int) -> float:
    return (miserable_users + constants.MISERY_ALPHA) / (
        unique_users + constants.MISERY_ALPHA + constants.MISERY_BETA
    )
