from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase


class BitbucketIntegrationTest(APITestCase):
    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = Integration.objects.create(
            provider="bitbucket",
            external_id=self.subject,
            name="sentryuser",
            metadata={
                "base_url": self.base_url,
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
    def test_get_repositories_exact_match(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser?name=stuf",
            json={"values": [{"full_name": "sentryuser/stuf"}]},
        )

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser?name~stuf",
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

        installation = self.integration.get_installation(self.organization)
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
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser?name~stuf",
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

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser?name=stuf",
            json={"values": []},
        )

        installation = self.integration.get_installation(self.organization)
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
