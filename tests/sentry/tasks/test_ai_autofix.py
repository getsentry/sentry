from datetime import datetime, timedelta

from sentry.models.group import Group
from sentry.tasks.ai_autofix import ai_autofix_check_for_timeout
from sentry.testutils.cases import TestCase


class TestAIAutofixCheckForTimeout(TestCase):
    def test_ai_autofix_check_for_timeout(self):
        created_at = datetime.now().isoformat()
        group = self.create_group()
        group.data["metadata"] = {
            "autofix": {
                "status": "PROCESSING",
                "created_at": created_at,
                "steps": [{"status": "PROCESSING"}, {"status": "PENDING"}],
            }
        }
        group.save()

        ai_autofix_check_for_timeout(group_id=group.id, created_at=created_at)

        updated_group = Group.objects.get(id=group.id)
        updated_autofix_data = updated_group.data["metadata"]["autofix"]
        assert updated_autofix_data["status"] == "ERROR"
        assert all(
            step["status"] == "ERROR"
            for step in updated_autofix_data["steps"]
            if step["status"] == "PROCESSING"
        )
        assert all(
            step["status"] == "CANCELLED"
            for step in updated_autofix_data["steps"]
            if step["status"] == "PENDING"
        )
        assert "completed_at" in updated_autofix_data

    def test_ai_autofix_check_for_timeout_no_change(self):
        created_at = datetime.now().isoformat()
        group = self.create_group()
        group.data["metadata"] = {
            "autofix": {
                "status": "COMPLETED",
                "created_at": created_at,
                "steps": [{"status": "COMPLETED"}],
            }
        }
        group.save()

        ai_autofix_check_for_timeout(group_id=group.id, created_at=created_at)

        updated_group = Group.objects.get(id=group.id)
        assert updated_group.data["metadata"]["autofix"]["status"] == "COMPLETED"

    def test_ai_autofix_check_for_newer_autofix(self):
        old_created_at = datetime.now().isoformat()
        newer_created_at = (datetime.now() + timedelta(minutes=1)).isoformat()
        group = self.create_group()
        group.data["metadata"] = {
            "autofix": {
                "status": "PROCESSING",
                "created_at": newer_created_at,
                "steps": [{"status": "PROCESSING"}, {"status": "PENDING"}],
            }
        }
        group.save()

        ai_autofix_check_for_timeout(group_id=group.id, created_at=old_created_at)

        updated_group = Group.objects.get(id=group.id)
        updated_autofix_data = updated_group.data["metadata"]["autofix"]
        # The status and steps should not change since a newer autofix has been created
        assert updated_autofix_data["status"] == "PROCESSING"
        assert updated_autofix_data["created_at"] == newer_created_at
        assert "completed_at" not in updated_autofix_data
        assert all(
            step["status"] == "PROCESSING"
            for step in updated_autofix_data["steps"]
            if step["status"] == "PROCESSING"
        )
        assert all(
            step["status"] == "PENDING"
            for step in updated_autofix_data["steps"]
            if step["status"] == "PENDING"
        )
