from enum import IntEnum

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey
from sentry.models import DefaultFieldsModel, Organization, User


class DemoOrgStatus(IntEnum):
    ACTIVE = 0
    PENDING = 1
    INITIALIZING = 2

    def __str__(self):
        return self.name

    @property
    def label(self):
        return DemoOrgStatus._labels[self]

    @classmethod
    def as_choices(cls):
        (
            (cls.ACTIVE, DemoOrgStatus._labels[cls.ACTIVE]),
            (cls.PENDING, DemoOrgStatus._labels[cls.PENDING]),
            (cls.INITIALIZING, DemoOrgStatus._labels[cls.INITIALIZING]),
        )


DemoOrgStatus._labels = {
    DemoOrgStatus.ACTIVE: "active",
    DemoOrgStatus.PENDING: "pending",
    DemoOrgStatus.INITIALIZING: "initializing",
}


class DemoOrganization(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization", unique=True)
    status = BoundedPositiveIntegerField(
        choices=DemoOrgStatus.as_choices(), default=DemoOrgStatus.INITIALIZING.value
    )
    date_assigned = models.DateTimeField(null=True)

    @classmethod
    def create_org(cls, *args, **kwargs):
        org = Organization.objects.create(*args, **kwargs)
        demo_org = cls.objects.create(organization=org)
        return demo_org

    def mark_assigned(self):
        self.status = DemoOrgStatus.ACTIVE.value
        self.date_assigned = timezone.now()
        self.save()

    @classmethod
    def get_one_pending_org(cls):
        return cls.objects.filter(status=DemoOrgStatus.PENDING).first()


class DemoUser(DefaultFieldsModel):
    __include_in_export__ = False

    user = FlexibleForeignKey("sentry.User", unique=True)
    date_assigned = models.DateTimeField(null=True)

    @classmethod
    def create_user(cls, *args, **kwargs):
        user = User.objects.create(*args, **kwargs)
        # assignment takes place on creation
        cls.objects.create(user=user, date_assigned=timezone.now())
        return user
