from typing import Any

from sentry.models.groupshare import GroupShare
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class SharedGroupDetailsTest(TestCase):
    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.org_domain = f"{self.organization.slug}.testserver"

    def share_group(self):
        with assume_test_silo_mode(SiloMode.REGION):
            return GroupShare.objects.create(
                project=self.project, group=self.group, user_id=self.user.id
            )

    def assert_group_metadata_present(self, response: Any):
        response_body = response.content.decode("utf8")
        assert f'<meta property="og:title" content="{self.group.title}"' in response_body
        assert f'<meta property="og:description" content="{self.group.message}"' in response_body
        assert '<meta property="twitter:card" content="summary"' in response_body
        assert f'<meta property="twitter:title" content="{self.group.title}"' in response_body
        assert (
            f'<meta property="twitter:description" content="{self.group.message}"' in response_body
        )

    def assert_group_metadata_absent(self, response: Any):
        response_body = response.content.decode("utf8")
        assert f'<meta property="og:title" content="{self.group.title}"' not in response_body
        assert (
            f'<meta property="og:description" content="{self.group.message}"' not in response_body
        )
        assert '<meta property="twitter:card" content="summary"' not in response_body
        assert f'<meta property="twitter:title" content="{self.group.title}"' not in response_body
        assert (
            f'<meta property="twitter:description" content="{self.group.message}"'
            not in response_body
        )

    def test_get_not_found(self):
        response = self.client.get("/share/issue/lolnope/", HTTP_HOST=self.org_domain)
        assert response.status_code == 200
        self.assert_group_metadata_absent(response)

    def test_get_org_disable_sharing(self):
        share = self.share_group()
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization.flags.disable_shared_issues = True
            self.organization.save()
        response = self.client.get(f"/share/issue/{share.uuid}/", HTTP_HOST=self.org_domain)
        assert response.status_code == 200
        self.assert_group_metadata_absent(response)

    def test_get_no_subdomain(self):
        share = self.share_group()
        response = self.client.get(f"/share/issue/{share.uuid}/")
        assert response.status_code == 200
        self.assert_group_metadata_present(response)

    def test_get_success(self):
        share = self.share_group()
        response = self.client.get(f"/share/issue/{share.uuid}/", HTTP_HOST=self.org_domain)
        assert response.status_code == 200
        self.assert_group_metadata_present(response)
