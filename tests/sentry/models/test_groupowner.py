from typing import int
from django.utils import timezone

from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class GroupOwnerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.timestamp = before_now(minutes=10)
        self.c = self.create_commit(
            project=self.project,
            repo=self.create_repo(self.project),
        )

        self.lookup_kwargs = {
            "group_id": self.group.id,
            "type": GroupOwnerType.SUSPECT_COMMIT.value,
            "user_id": self.user.id,
            "project_id": self.project.id,
            "organization_id": self.organization.id,
        }
        self.scm_extra_lookup = {"context__asjsonb__commitId": self.c.id}

        self.defaults = {
            "date_added": self.timestamp,
        }

        self.scm_context_defaults = {
            "commitId": self.c.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

        self.rb_context_defaults = {
            "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
        }

    def _make_scm_lookup_kwargs(self) -> None:
        """
        scm_based lookup_kwargs include an additional filter: context__contains,
        release_based group owners don't have this field in context.
        """
        self.lookup_kwargs.update(self.scm_extra_lookup)

    def test_update_or_create_and_preserve_context_create_then_update_scm(self) -> None:
        assert GroupOwner.objects.filter(**self.lookup_kwargs).exists() is False

        self._make_scm_lookup_kwargs()

        obj, created = GroupOwner.objects.update_or_create_and_preserve_context(
            lookup_kwargs=self.lookup_kwargs,
            defaults=self.defaults,
            context_defaults=self.scm_context_defaults,
        )

        assert GroupOwner.objects.filter(**self.lookup_kwargs).exists() is True
        assert created is True
        assert obj.group_id == self.group.id
        assert obj.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert obj.user_id == self.user.id
        assert obj.project_id == self.project.id
        assert obj.organization_id == self.organization.id
        assert obj.date_added == self.timestamp
        assert obj.context == self.scm_context_defaults

        now = timezone.now()
        obj, created = GroupOwner.objects.update_or_create_and_preserve_context(
            lookup_kwargs=self.lookup_kwargs,
            defaults={
                "date_added": now,
            },
            context_defaults=self.scm_context_defaults,
        )

        assert created is False
        assert obj.group_id == self.group.id
        assert obj.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert obj.user_id == self.user.id
        assert obj.project_id == self.project.id
        assert obj.organization_id == self.organization.id
        assert obj.date_added == now
        assert obj.context == self.scm_context_defaults

    def test_update_or_create_and_preserve_context_update_scm(self) -> None:
        original_obj = GroupOwner.objects.create(
            context={
                "commitId": self.c.id,
                "something": "else",
            },
            **self.lookup_kwargs,
            **self.defaults,
        )

        self._make_scm_lookup_kwargs()
        obj, created = GroupOwner.objects.update_or_create_and_preserve_context(
            lookup_kwargs=self.lookup_kwargs,
            defaults=self.defaults,
            context_defaults=self.scm_context_defaults,
        )

        assert created is False
        assert original_obj.id == obj.id
        assert obj.group_id == self.group.id
        assert obj.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert obj.user_id == self.user.id
        assert obj.project_id == self.project.id
        assert obj.organization_id == self.organization.id
        assert obj.date_added == self.timestamp
        assert obj.context == {
            "commitId": self.c.id,
            "something": "else",
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

    def test_update_or_create_and_preserve_context_create_then_update_rb(self) -> None:
        assert GroupOwner.objects.filter(**self.lookup_kwargs).exists() is False

        obj, created = GroupOwner.objects.update_or_create_and_preserve_context(
            lookup_kwargs=self.lookup_kwargs,
            defaults=self.defaults,
            context_defaults=self.rb_context_defaults,
        )

        assert GroupOwner.objects.filter(**self.lookup_kwargs).exists() is True
        assert created is True
        assert obj.group_id == self.group.id
        assert obj.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert obj.user_id == self.user.id
        assert obj.project_id == self.project.id
        assert obj.organization_id == self.organization.id
        assert obj.date_added == self.timestamp
        assert obj.context == self.rb_context_defaults

        now = timezone.now()
        obj, created = GroupOwner.objects.update_or_create_and_preserve_context(
            lookup_kwargs=self.lookup_kwargs,
            defaults={
                "date_added": now,
            },
            context_defaults=self.rb_context_defaults,
        )

        assert created is False
        assert obj.group_id == self.group.id
        assert obj.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert obj.user_id == self.user.id
        assert obj.project_id == self.project.id
        assert obj.organization_id == self.organization.id
        assert obj.date_added == now
        assert obj.context == self.rb_context_defaults
