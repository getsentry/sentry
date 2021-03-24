class ObjectStatus:
    VISIBLE = 0
    HIDDEN = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3

    ACTIVE = 0
    DISABLED = 1

    @classmethod
    def as_choices(cls):
        return (
            (cls.ACTIVE, "active"),
            (cls.DISABLED, "disabled"),
            (cls.PENDING_DELETION, "pending_deletion"),
            (cls.DELETION_IN_PROGRESS, "deletion_in_progress"),
        )
