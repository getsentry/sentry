from unittest import TestCase

from sentry.profiles.device import GIB, DeviceClass, classify_device


class ProfilesDeviceTest(TestCase):
    def test_known_ios_device(self):
        self.assertEqual(classify_device("iPhone14,3", "iOS", False), DeviceClass.HIGH_END)

    def test_emulated_ios_device(self):
        self.assertEqual(classify_device("iPhone14,3", "iOS", True), DeviceClass.UNCLASSIFIED)

    def test_android_device_without_optional_params(self):
        self.assertEqual(classify_device("Pixel 6 Pro", "android", False), DeviceClass.UNCLASSIFIED)

    def test_known_android_device(self):
        self.assertEqual(
            classify_device("Pixel 6 Pro", "android", False, [8000] * 8, 8 * GIB),
            DeviceClass.HIGH_END,
        )

    def test_simulated_android_device(self):
        self.assertEqual(classify_device("Pixel 6 Pro", "android", True), DeviceClass.UNCLASSIFIED)

    def test_unknown_platform(self):
        self.assertEqual(
            classify_device("SentryPhone", "SentryOS", False), DeviceClass.UNCLASSIFIED
        )

    def test_unknown_device(self):
        self.assertEqual(classify_device("SentryPhone", "SentryOS", True), DeviceClass.UNCLASSIFIED)
