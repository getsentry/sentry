import pytest

from sentry.api.bases.group import get_group
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Group, GroupRedirect
from sentry.testutils import TestCase


class GroupEndpointTestCase(TestCase):
    def test_get_group_respects_redirect(self):
        group = self.create_group()
        duplicate_id = self.create_group().id
        Group.objects.filter(id=duplicate_id).delete()
        GroupRedirect.objects.create(
            group_id=group.id,
            previous_group_id=duplicate_id,
        )

        assert get_group(duplicate_id).id == group.id

        # We shouldn't end up in a case where the redirect points to a bad
        # reference, but testing this path for completeness.
        group.delete()

        with pytest.raises(ResourceDoesNotExist):
            get_group(duplicate_id)
