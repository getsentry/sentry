from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.message_filters import _legacy_browsers_filter, get_filter_key  # noqa
from sentry.models.projectoption import ProjectOption
from sentry.models.auditlogentry import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import APITestCase, TestCase
from sentry.utils.canonical import CanonicalKeyView
from sentry.relay.config import ProjectConfig, _filter_option_to_config_setting  # noqa

USER_AGENTS = {
    "android_2": "Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40) AppleWebKit/533.1 (KHTML, like Gecko) "
    "Version/4.0 Mobile Safari/533.1",
    "android_4": "Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) "
    "Chrome/18.0.1025.133 Mobile Safari/535.19",
    "ie_5": "Mozilla/4.0 (compatible; MSIE 5.50; Windows NT; SiteKiosk 4.9; SiteCoach 1.0)",
    "ie_8": "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Win64; x64; Trident/4.0; .NET CLR 2.0.50727; SLCC2; .NET "
    "CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; MDDC; Tablet PC 2.0)",
    "ie_9": "Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))",
    "iemobile_9": "Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0; IEMobile/9.0; NOKIA; Lumia 710)",
    "ie_10": "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)",
    "iemobile_10": "Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia "
    "520)",
    "opera_11": "Opera/9.80 (Windows NT 5.1; U; it) Presto/2.7.62 Version/11.00",
    "opera_12": "Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16",
    "opera_15": "Mozilla/5.0 (X11; Linux x86_64; Debian) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.52 "
    "Safari/537.36 OPR/15.0.1147.100",
    "chrome": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
    "edge": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 "
    "Edge/12.10136",
    "safari_5": "Mozilla/5.0 (Windows; U; Windows NT 6.1; zh-HK) AppleWebKit/533.18.1 (KHTML, like Gecko) Version/5.0.2 "
    "Safari/533.18.5",
    "safari_7": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 "
    "Safari/7046A194A",
    "opera_mini_8": "Opera/9.80 (J2ME/MIDP; Opera Mini/8.0.35158/36.2534; U; en) Presto/2.12.423 Version/12.16",
    "opera_mini_7": "Opera/9.80 (J2ME/MIDP; Opera Mini/7.0.32796/59.323; U; fr) Presto/2.12.423 Version/12.16",
}


class SetLegacyBrowserFilterTest(APITestCase):
    def test_set_default_all_browsers(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"active": True})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == "1"

    def test_set_default_no_browsers(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"active": False})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == "0"

    def test_set_opera(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["opera_pre_15"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"opera_pre_15"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()

    def test_set_opera_mini(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["opera_mini_pre_8"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"opera_mini_pre_8"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()

    def test_set_ie9(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["ie9"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"ie9"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()

    def test_set_ie8(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["ie_pre_9"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"ie_pre_9"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()

    def test_set_android(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["android_pre_4"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"android_pre_4"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()

    def test_set_safari(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-filters",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "filter_id": "legacy-browsers",
            },
        )
        response = self.client.put(url, data={"subfilters": ["safari_pre_6"]})
        assert response.status_code == 201, response.content

        options = ProjectOption.objects.get_value(project=project, key="filters:legacy-browsers")
        assert options == {"safari_pre_6"}

        assert AuditLogEntry.objects.filter(
            organization=project.organization, event=AuditLogEntryEvent.PROJECT_ENABLE
        ).exists()


class LegacyBrowsersFilterTest(TestCase):
    def apply_filter(self, project_config, data):
        return _legacy_browsers_filter(project_config, CanonicalKeyView(data))

    def get_mock_data(self, user_agent):
        return {
            "platform": "javascript",
            "request": {
                "url": "http://example.com",
                "method": "GET",
                "headers": [["User-Agent", user_agent]],
            },
        }

    def _get_project_config(self, filter_opt=None):
        """
        Constructs a test project_config with the provided legacy_browsers filter setting
        :param filter_opt: the value for 'filters:legacy-browsers' project options (may be None)
        :return: a ProjectConfig object with the filter option set and the project taken from
        the TestCase
        """
        ret_val = ProjectConfig(self.project, config={})
        config = ret_val.config
        filter_settings = {}
        config["filterSettings"] = filter_settings
        if filter_opt is not None:
            key = get_filter_key(_legacy_browsers_filter)
            filter_settings[key] = _filter_option_to_config_setting(
                _legacy_browsers_filter, filter_opt
            )
        return ret_val

    def test_filters_android_2_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["android_2"])
        assert self.apply_filter(project_config, data) is True

    def test_does_not_filter_android_4_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["android_4"])
        assert self.apply_filter(project_config, data) is False

    def test_filters_ie_9_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["ie_9"])
        assert self.apply_filter(project_config, data) is True

    def test_filters_iemobile_9_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["iemobile_9"])
        assert self.apply_filter(project_config, data) is True

    def test_does_not_filter_ie_10_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["ie_10"])
        assert self.apply_filter(project_config, data) is False

    def test_does_not_filter_iemobile_10_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["iemobile_10"])
        assert self.apply_filter(project_config, data) is False

    def test_filters_opera_12_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["opera_12"])
        assert self.apply_filter(project_config, data) is True

    def test_filters_opera_mini_7_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["opera_mini_7"])
        assert self.apply_filter(project_config, data) is True

    def test_does_not_filter_chrome_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["chrome"])
        assert self.apply_filter(project_config, data) is False

    def test_does_not_filter_edge_by_default(self):
        project_config = self._get_project_config("1")
        data = self.get_mock_data(USER_AGENTS["edge"])
        assert self.apply_filter(project_config, data) is False

    def test_filter_opera(self):
        project_config = self._get_project_config(["opera_pre_15"])
        data = self.get_mock_data(USER_AGENTS["opera_12"])
        assert self.apply_filter(project_config, data) is True

    def test_filter_opera_method(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["opera_12"])
        assert self.apply_filter(project_config, data) is True

    def test_dont_filter_opera_15(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["opera_15"])
        assert self.apply_filter(project_config, data) is False

    def test_filter_opera_mini(self):
        project_config = self._get_project_config(["opera_mini_pre_8"])
        data = self.get_mock_data(USER_AGENTS["opera_mini_7"])
        assert self.apply_filter(project_config, data) is True

    def test_filter_opera_mini_method(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["opera_mini_7"])
        assert self.apply_filter(project_config, data) is True

    def test_dont_filter_opera_mini_8(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["opera_mini_8"])
        assert self.apply_filter(project_config, data) is False

    def test_filters_ie8(self):
        project_config = self._get_project_config(["ie_pre_9"])
        data = self.get_mock_data(USER_AGENTS["ie_8"])
        assert self.apply_filter(project_config, data) is True

    def test_filters_ie8_method(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["ie_8"])
        assert self.apply_filter(project_config, data) is True

    def test_does_filter_ie9(self):
        project_config = self._get_project_config(["ie9"])
        data = self.get_mock_data(USER_AGENTS["ie_9"])
        assert self.apply_filter(project_config, data) is True

    def test_does_filter_iemobile_9(self):
        project_config = self._get_project_config(["ie9"])
        data = self.get_mock_data(USER_AGENTS["iemobile_9"])
        assert self.apply_filter(project_config, data) is True

    def test_does_filter_ie10(self):
        project_config = self._get_project_config(["ie10"])
        data = self.get_mock_data(USER_AGENTS["ie_10"])
        assert self.apply_filter(project_config, data) is True

    def test_does_not_filter_ie10(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["ie_10"])
        assert self.apply_filter(project_config, data) is False

    def test_does_filter_iemobile_10(self):
        project_config = self._get_project_config(["ie10"])
        data = self.get_mock_data(USER_AGENTS["iemobile_10"])
        assert self.apply_filter(project_config, data) is True

    def test_does_not_filter_iemobile_10(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["iemobile_10"])
        assert self.apply_filter(project_config, data) is False

    def test_filters_safari(self):
        project_config = self._get_project_config(["safari_pre_6"])
        data = self.get_mock_data(USER_AGENTS["safari_5"])
        assert self.apply_filter(project_config, data) is True

    def test_filters_safari_method(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["safari_5"])
        assert self.apply_filter(project_config, data) is True

    def test_method_does_not_filter_safari_7(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["safari_7"])
        assert self.apply_filter(project_config, data) is False

    def test_filters_android(self):
        project_config = self._get_project_config(["android_pre_4"])
        data = self.get_mock_data(USER_AGENTS["android_2"])
        assert self.apply_filter(project_config, data) is True

    def test_filters_android_method(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["android_2"])
        assert self.apply_filter(project_config, data) is True

    def test_method_does_not_filter_android_4(self):
        project_config = self._get_project_config()
        data = self.get_mock_data(USER_AGENTS["android_4"])
        assert self.apply_filter(project_config, data) is False
