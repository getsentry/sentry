from os import pardir
from os.path import join
from unittest import TestCase

from exam import fixture

from sentry.constants import MODULE_ROOT
from sentry.profiles.tasks import _normalize, _validate_ios_profile
from sentry.utils import json

PROFILES_FIXTURES_PATH = join(MODULE_ROOT, pardir, pardir, "tests", "fixtures", "profiles")


class ProfilesTasksTest(TestCase):
    @fixture
    def ios_profile(self):
        path = join(PROFILES_FIXTURES_PATH, "valid_ios_profile.json")
        with open(path) as f:
            return json.loads(f.read())

    @fixture
    def android_profile(self):
        path = join(PROFILES_FIXTURES_PATH, "valid_android_profile.json")
        with open(path) as f:
            return json.loads(f.read())

    def test_valid_ios_profile(self):
        profile = {
            "sampled_profile": {"samples": []},
        }
        self.assertEqual(_validate_ios_profile(profile), True)

    def test_invalid_ios_profile(self):
        profile = {
            "snmpled_profile": {},
        }
        self.assertEqual(_validate_ios_profile(profile), False)
        profile = {
            "sampled_profile": {"no_frames": []},
        }
        self.assertEqual(_validate_ios_profile(profile), False)

    def test_normalize_ios_profile(self):
        profile = _normalize(self.ios_profile)
        for k in ["device_os_build_number", "device_classification"]:
            assert k in profile

    def test_normalize_android_profile(self):
        profile = _normalize(self.android_profile)
        for k in ["android_api_level", "device_classification"]:
            assert k in profile

        assert isinstance(profile["android_api_level"], int)
