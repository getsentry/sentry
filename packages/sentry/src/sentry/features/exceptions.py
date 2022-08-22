__all__ = ["FeatureNotRegistered"]


class FeatureNotRegistered(Exception):
    def __init__(self, name: str) -> None:
        msg = (
            'The "{}" feature has not been registered. '
            "Ensure that a feature has been added to sentry.features.default_manager"
        )
        super(Exception, self).__init__(msg.format(name))
