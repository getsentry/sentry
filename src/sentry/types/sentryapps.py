class SentryAppStatus:
    UNPUBLISHED = 0
    PUBLISHED = 1
    INTERNAL = 2
    PUBLISH_REQUEST_INPROGRESS = 3
    UNPUBLISHED_STR = "unpublished"
    PUBLISHED_STR = "published"
    INTERNAL_STR = "internal"
    PUBLISH_REQUEST_INPROGRESS_STR = "publish_request_inprogress"

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNPUBLISHED, str(cls.UNPUBLISHED_STR)),
            (cls.PUBLISHED, str(cls.PUBLISHED_STR)),
            (cls.INTERNAL, str(cls.INTERNAL_STR)),
            (cls.PUBLISH_REQUEST_INPROGRESS, str(cls.PUBLISH_REQUEST_INPROGRESS_STR)),
        )

    @classmethod
    def as_str(cls, status):
        if status == cls.UNPUBLISHED:
            return cls.UNPUBLISHED_STR
        elif status == cls.PUBLISHED:
            return cls.PUBLISHED_STR
        elif status == cls.INTERNAL:
            return cls.INTERNAL_STR
        elif status == cls.PUBLISH_REQUEST_INPROGRESS:
            return cls.PUBLISH_REQUEST_INPROGRESS_STR


class SentryAppInstallationStatus:
    PENDING = 0
    INSTALLED = 1
    PENDING_STR = "pending"
    INSTALLED_STR = "installed"

    @classmethod
    def as_choices(cls):
        return (
            (cls.PENDING, str(cls.PENDING_STR)),
            (cls.INSTALLED, str(cls.INSTALLED_STR)),
        )
