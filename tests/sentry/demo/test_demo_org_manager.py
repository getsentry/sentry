import pytest
import pytz

from datetime import datetime
from django.test import override_settings

from sentry.demo.demo_org_manager import create_demo_org, assign_demo_org
from sentry.demo.models import DemoOrganization, DemoUser, DemoOrgStatus
from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    Project,
    ProjectKey,
    Team,
)
from sentry.testutils import TestCase
from sentry.utils.compat import mock
from sentry.utils.email import create_fake_email


org_owner_email = "james@example.com"
org_name = "Org Name"


@override_settings(DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email)
class DemoOrgManagerTest(TestCase):
    @mock.patch("sentry.demo.demo_org_manager.handle_react_python_scenario")
    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    def test_create_demo_org(self, mock_generate_name, mock_handle_scenario):
        owner = User.objects.create(email=org_owner_email)

        create_demo_org()

        demo_org = DemoOrganization.objects.get(
            organization__name=org_name, status=DemoOrgStatus.PENDING
        )
        org = demo_org.organization

        assert OrganizationMember.objects.filter(
            user=owner, organization=org, role="owner"
        ).exists()

        assert len(Project.objects.filter(organization=org)) == 2
        assert not ProjectKey.objects.filter(project__organization=org).exists()
        mock_handle_scenario.assert_called_once_with(mock.ANY, mock.ANY, quick=False)

    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    def test_no_owner(self, mock_generate_name):
        with pytest.raises(User.DoesNotExist):
            create_demo_org()

        # verify we are using atomic transactions
        assert not Organization.objects.filter(name=org_name).exists()

    @mock.patch("django.utils.timezone.now")
    @mock.patch("sentry.demo.tasks.build_up_org_buffer.apply_async")
    def test_assign_demo_org(self, mock_build_up_org_buffer, mock_now):
        curr_time = datetime.utcnow().replace(tzinfo=pytz.utc)
        mock_now.return_value = curr_time

        org_slug = "some_org"
        org = self.create_organization(org_slug)
        DemoOrganization.objects.create(organization=org, status=DemoOrgStatus.PENDING)

        Team.objects.create(organization=org)

        (org, user) = assign_demo_org()

        assert OrganizationMember.objects.filter(
            user=user, organization=org, role="member"
        ).exists()
        assert user.email == create_fake_email(org.slug, "demo")

        demo_org = DemoOrganization.objects.get(organization=org, status=DemoOrgStatus.ACTIVE)
        demo_user = DemoUser.objects.get(user=user)

        assert demo_org.date_assigned == curr_time
        assert demo_user.date_assigned == curr_time

        mock_build_up_org_buffer.assert_called_once_with()

    @mock.patch("sentry.demo.demo_org_manager.handle_react_python_scenario")
    def test_no_org_ready(self, mock_handle_scenario):
        User.objects.create(email=org_owner_email)
        assign_demo_org()
        mock_handle_scenario.assert_called_once_with(mock.ANY, mock.ANY, quick=True)

    @mock.patch("sentry.demo.demo_org_manager.delete_organization.apply_async")
    @mock.patch("sentry.demo.demo_org_manager.handle_react_python_scenario")
    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    def test_data_population_fails(
        self, mock_generate_name, mock_handle_scenario, mock_delete_organization
    ):
        User.objects.create(email=org_owner_email)

        class HandleScenarioException(Exception):
            pass

        mock_handle_scenario.side_effect = HandleScenarioException("failure")
        with pytest.raises(HandleScenarioException):
            assign_demo_org()

        org = Organization.objects.get(name=org_name)
        assert org.status == OrganizationStatus.PENDING_DELETION

        mock_delete_organization.assert_called_once_with(kwargs={"object_id": org.id})
