__all__ = ["PluginStatusMixin"]


class PluginStatus:
    BETA = "beta"
    STABLE = "stable"
    UNKNOWN = "unknown"


class PluginStatusMixin:
    status = PluginStatus.UNKNOWN

    @classmethod
    def get_status(cls):
        return cls.status
