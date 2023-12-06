from urllib.parse import quote, urlencode

import responses
from django.urls import reverse

from sentry.integrations.bitbucket import BitbucketIntegrationProvider
from sentry.models.integrations.integration import Integration
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class BitbucketIntegrationTest(APITestCase):
    provider = BitbucketIntegrationProvider

    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.subject,
            name="sentryuser",
            metadata={
                "base_url": self.base_url,
                "domain_name": "bitbucket.org/Test-Organization",
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )
        self.login_as(self.user)
        self.integration.add_organization(self.organization, self.user)
        self.path = reverse(
            "sentry-extensions-bitbucket-search", args=[self.organization.slug, self.integration.id]
        )

    @responses.activate
    def test_get_repositories_with_uuid(self):
        uuid = "{a21bd75c-0ce2-402d-b70b-e57de6fba4b3}"
        self.integration.metadata["uuid"] = uuid
        url = f"https://api.bitbucket.org/2.0/repositories/{quote(uuid)}"
        responses.add(
            responses.GET,
            url,
            json={"values": [{"full_name": "sentryuser/stuf"}]},
        )
        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories()
        assert result == [{"identifier": "sentryuser/stuf", "name": "sentryuser/stuf"}]

    @responses.activate
    def test_get_repositories_exact_match(self):
        querystring = urlencode({"q": 'name="stuf"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={"values": [{"full_name": "sentryuser/stuf"}]},
        )

        querystring = urlencode({"q": 'name~"stuf"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={
                "values": [
                    {"full_name": "sentryuser/stuff"},
                    {"full_name": "sentryuser/stuff-2010"},
                    {"full_name": "sentryuser/stuff-2011"},
                    {"full_name": "sentryuser/stuff-2012"},
                    {"full_name": "sentryuser/stuff-2013"},
                    {"full_name": "sentryuser/stuff-2014"},
                    {"full_name": "sentryuser/stuff-2015"},
                    {"full_name": "sentryuser/stuff-2016"},
                    {"full_name": "sentryuser/stuff-2016"},
                    {"full_name": "sentryuser/stuff-2017"},
                    {"full_name": "sentryuser/stuff-2018"},
                    {"full_name": "sentryuser/stuff-2019"},
                ]
            },
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories("stuf")
        assert result == [
            {"identifier": "sentryuser/stuf", "name": "sentryuser/stuf"},
            {"identifier": "sentryuser/stuff", "name": "sentryuser/stuff"},
            {"identifier": "sentryuser/stuff-2010", "name": "sentryuser/stuff-2010"},
            {"identifier": "sentryuser/stuff-2011", "name": "sentryuser/stuff-2011"},
            {"identifier": "sentryuser/stuff-2012", "name": "sentryuser/stuff-2012"},
            {"identifier": "sentryuser/stuff-2013", "name": "sentryuser/stuff-2013"},
            {"identifier": "sentryuser/stuff-2014", "name": "sentryuser/stuff-2014"},
            {"identifier": "sentryuser/stuff-2015", "name": "sentryuser/stuff-2015"},
            {"identifier": "sentryuser/stuff-2016", "name": "sentryuser/stuff-2016"},
            {"identifier": "sentryuser/stuff-2017", "name": "sentryuser/stuff-2017"},
            {"identifier": "sentryuser/stuff-2018", "name": "sentryuser/stuff-2018"},
            {"identifier": "sentryuser/stuff-2019", "name": "sentryuser/stuff-2019"},
        ]

    @responses.activate
    def test_get_repositories_no_exact_match(self):
        querystring = urlencode({"q": 'name~"stu"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={
                "values": [
                    {"full_name": "sentryuser/stuff"},
                    {"full_name": "sentryuser/stuff-2010"},
                    {"full_name": "sentryuser/stuff-2011"},
                    {"full_name": "sentryuser/stuff-2012"},
                    {"full_name": "sentryuser/stuff-2013"},
                    {"full_name": "sentryuser/stuff-2014"},
                    {"full_name": "sentryuser/stuff-2015"},
                    {"full_name": "sentryuser/stuff-2016"},
                    {"full_name": "sentryuser/stuff-2016"},
                    {"full_name": "sentryuser/stuff-2017"},
                    {"full_name": "sentryuser/stuff-2018"},
                    {"full_name": "sentryuser/stuff-2019"},
                ]
            },
        )

        querystring = urlencode({"q": 'name="stu"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={"values": []},
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories("stu")
        assert result == [
            {"identifier": "sentryuser/stuff", "name": "sentryuser/stuff"},
            {"identifier": "sentryuser/stuff-2010", "name": "sentryuser/stuff-2010"},
            {"identifier": "sentryuser/stuff-2011", "name": "sentryuser/stuff-2011"},
            {"identifier": "sentryuser/stuff-2012", "name": "sentryuser/stuff-2012"},
            {"identifier": "sentryuser/stuff-2013", "name": "sentryuser/stuff-2013"},
            {"identifier": "sentryuser/stuff-2014", "name": "sentryuser/stuff-2014"},
            {"identifier": "sentryuser/stuff-2015", "name": "sentryuser/stuff-2015"},
            {"identifier": "sentryuser/stuff-2016", "name": "sentryuser/stuff-2016"},
            {"identifier": "sentryuser/stuff-2017", "name": "sentryuser/stuff-2017"},
            {"identifier": "sentryuser/stuff-2018", "name": "sentryuser/stuff-2018"},
            {"identifier": "sentryuser/stuff-2019", "name": "sentryuser/stuff-2019"},
        ]

    @responses.activate
    def test_source_url_matches(self):
        installation = self.integration.get_installation(self.organization.id)

        test_cases = [
            (
                "https://bitbucket.org/Test-Organization/sentry/src/master/src/sentry/integrations/bitbucket/integration.py",
                True,
            ),
            (
                "https://notbitbucket.org/Test-Organization/sentry/src/master/src/sentry/integrations/bitbucket/integration.py",
                False,
            ),
            ("https://jianyuan.io", False),
        ]
        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    @responses.activate
    def test_extract_branch_from_source_url(self):
        installation = self.integration.get_installation(self.organization.id)
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://bitbucket.org/Test-Organization/repo",
                provider="integrations:bitbucket",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://bitbucket.org/Test-Organization/repo/src/master/src/sentry/integrations/bitbucket/integration.py"

        assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self):
        installation = self.integration.get_installation(self.organization.id)
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://bitbucket.org/Test-Organization/repo",
                provider="integrations:bitbucket",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://bitbucket.org/Test-Organization/repo/src/master/src/sentry/integrations/bitbucket/integration.py"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/bitbucket/integration.py"
        )
