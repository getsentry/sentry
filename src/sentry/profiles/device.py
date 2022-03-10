from enum import Enum
from typing import List

GIB = 1024 * 1024 * 1024
UNKNOWN_DEVICE = "Unknown Device"


class DeviceClass(Enum):
    UNCLASSIFIED = 0
    LOW_END = 1
    MID_END = 2
    HIGH_END = 3

    def __str__(self):
        return {0: "unclassified", 1: "low", 2: "mid", 3: "high"}[self.value]


class Platform(Enum):
    UNKNOWN = 0
    IOS_DEVICE = 1
    IOS_SIMULATOR = 2
    ANDROID_DEVICE = 3
    ANDROID_EMULATOR = 4


# ClassifyDevice classifies a device as being low, mid, or high end based on the
# criteria documented in https:#www.notion.so/specto/Mobile-Device-Classification-f1e6fe9650104655a576c0cd00e04657
def classify_device(
    model: str,
    os_name: str,
    is_emulator: bool,
    cpu_frequencies: List[int] = None,
    physical_memory_bytes: int = None,
) -> DeviceClass:
    platform = get_platform(os_name, is_emulator)
    if platform in (Platform.IOS_SIMULATOR, Platform.ANDROID_EMULATOR):
        """
        We exclude simulators/emulators from performance statistics for
        low/mid/high end because these run on arbitrary PC hardware and
        will make our data noisy.
        """
        return DeviceClass.UNCLASSIFIED

    if platform == Platform.IOS_DEVICE:
        frequencies = ios_cpu_core_max_frequencies_mhz(model)
        if core_frequency(frequencies) < 2000:
            return DeviceClass.LOW_END  # less than 2GHz clock speed
        if number_of_cores(frequencies) < 6:
            return DeviceClass.MID_END  # less than 6 cores
        return DeviceClass.HIGH_END

    if platform == Platform.ANDROID_DEVICE and cpu_frequencies and physical_memory_bytes:
        if number_of_cores(cpu_frequencies) < 8 or physical_memory_bytes < (4 * GIB):
            return DeviceClass.LOW_END  # less than 8 cores or less than 4GiB of RAM
        if core_frequency(cpu_frequencies) < 2500:
            return DeviceClass.MID_END  # less than 2.5GHz clock speed
        return DeviceClass.HIGH_END

    return DeviceClass.UNCLASSIFIED


def number_of_cores(frequencies: List[int]) -> int:
    return len(frequencies)


def core_frequency(frequencies: List[int]) -> int:
    return max(frequencies)


def get_platform(device_os_name: str, is_emulator: bool) -> str:
    if device_os_name == "android":
        if is_emulator:
            return Platform.ANDROID_EMULATOR
        return Platform.ANDROID_DEVICE
    if device_os_name in ("iPhone OS", "iOS", "iPadOS", "watchOS", "tvOS"):
        if is_emulator:
            return Platform.IOS_SIMULATOR
        return Platform.IOS_DEVICE
    return Platform.UNKNOWN


def ios_human_readable_model_name(model: str) -> str:
    # https:#www.theiphonewiki.com/wiki/Models
    if model in ("iPhone1,1"):
        return "iPhone (1st gen)"
    if model in ("iPhone1,2"):
        return "iPhone 3G"
    if model in ("iPhone2,1"):
        return "iPhone 3GS"
    if model in ("iPhone3,1", "iPhone3,2", "iPhone3,3"):
        return "iPhone 4"
    if model in ("iPhone4,1"):
        return "iPhone 4S"
    if model in ("iPhone5,1", "iPhone5,2"):
        return "iPhone 5"
    if model in ("iPhone5,3", "iPhone5,4"):
        return "iPhone 5c"
    if model in ("iPhone6,1", "iPhone6,2"):
        return "iPhone 5s"
    if model in ("iPhone7,2"):
        return "iPhone 6"
    if model in ("iPhone7,1"):
        return "iPhone 6 Plus"
    if model in ("iPhone8,1"):
        return "iPhone 6s"
    if model in ("iPhone8,2"):
        return "iPhone 6s Plus"
    if model in ("iPhone8,4"):
        return "iPhone SE (1st gen)"
    if model in ("iPhone9,1", "iPhone9,3"):
        return "iPhone 7"
    if model in ("iPhone9,2", "iPhone9,4"):
        return "iPhone 7 Plus"
    if model in ("iPhone10,1", "iPhone10,4"):
        return "iPhone 8"
    if model in ("iPhone10,2", "iPhone10,5"):
        return "iPhone 8 Plus"
    if model in ("iPhone10,3", "iPhone10,6"):
        return "iPhone X"
    if model in ("iPhone11,8"):
        return "iPhone XR"
    if model in ("iPhone11,2"):
        return "iPhone XS"
    if model in ("iPhone11,4", "iPhone11,6"):
        return "iPhone XS Max"
    if model in ("iPhone12,1"):
        return "iPhone 11"
    if model in ("iPhone12,3"):
        return "iPhone 11 Pro"
    if model in ("iPhone12,5"):
        return "iPhone 11 Pro Max"
    if model in ("iPhone12,8"):
        return "iPhone SE (2nd gen)"
    if model in ("iPhone13,1"):
        return "iPhone 12 mini"
    if model in ("iPhone13,2"):
        return "iPhone 12"
    if model in ("iPhone13,3"):
        return "iPhone 12 Pro"
    if model in ("iPhone13,4"):
        return "iPhone 12 Pro Max"
    if model in ("iPhone14,4"):
        return "iPhone 13 mini"
    if model in ("iPhone14,5"):
        return "iPhone 13"
    if model in ("iPhone14,2"):
        return "iPhone 13 Pro"
    if model in ("iPhone14,3"):
        return "iPhone 13 Pro Max"
    if model in ("iPod1,1"):
        return "iPod touch (1st gen)"
    if model in ("iPod2,1"):
        return "iPod touch (2nd gen)"
    if model in ("iPod3,1"):
        return "iPod touch (3rd gen)"
    if model in ("iPod4,1"):
        return "iPod touch (4th gen)"
    if model in ("iPod5,1"):
        return "iPod touch (5th gen)"
    if model in ("iPod7,1"):
        return "iPod touch (6th gen)"
    if model in ("iPod9,1"):
        return "iPod touch (7th gen)"
    if model in ("iPad1,1"):
        return "iPad (1st gen)"
    if model in ("iPad2,1", "iPad2,2", "iPad2,3", "iPad2,4"):
        return "iPad 2"
    if model in ("iPad3,1", "iPad3,2", "iPad3,3"):
        return "iPad (3rd gen)"
    if model in ("iPad3,4", "iPad3,5", "iPad3,6"):
        return "iPad (4th gen)"
    if model in ("iPad6,11", "iPad6,12"):
        return "iPad (5th gen)"
    if model in ("iPad7,5", "iPad7,6"):
        return "iPad (6th gen)"
    if model in ("iPad7,11", "iPad7,12"):
        return "iPad (7th gen)"
    if model in ("iPad11,6", "iPad11,7"):
        return "iPad (8th gen)"
    if model in ("iPad12,1", "iPad12,2"):
        return "iPad (9th gen)"
    if model in ("iPad4,1", "iPad4,2", "iPad4,3"):
        return "iPad Air (1st gen)"
    if model in ("iPad5,3", "iPad5,4"):
        return "iPad Air 2"
    if model in ("iPad11,3", "iPad11,4"):
        return "iPad Air (3rd gen)"
    if model in ("iPad13,1", "iPad13,2"):
        return "iPad Air (4th gen)"
    if model in ("iPad6,7", "iPad6,8"):
        return "iPad Pro (12.9-inch, 1st gen)"
    if model in ("iPad6,3", "iPad6,4"):
        return "iPad Pro (9.7-inch, 1st gen)"
    if model in ("iPad7,1", "iPad7,2"):
        return "iPad Pro (12.9-inch, 2nd gen)"
    if model in ("iPad7,3", "iPad7,4"):
        return "iPad Pro (10.5-inch)"
    if model in ("iPad8,1", "iPad8,2", "iPad8,3", "iPad8,4"):
        return "iPad Pro (11-inch, 1st gen)"
    if model in ("iPad8,5", "iPad8,6", "iPad8,7", "iPad8,8"):
        return "iPad Pro (12.9-inch, 3rd gen)"
    if model in ("iPad8,9", "iPad8,10"):
        return "iPad Pro (11-inch, 2nd gen)"
    if model in ("iPad8,11", "iPad8,12"):
        return "iPad Pro (12.9-inch, 4th gen)"
    if model in ("iPad13,4", "iPad13,5", "iPad13,6", "iPad13,7"):
        return "iPad Pro (11-inch, 3rd gen)"
    if model in ("iPad13,8", "iPad13,9", "iPad13,10", "iPad13,11"):
        return "iPad Pro (12.9-inch, 5th gen)"
    if model in ("iPad2,5", "iPad2,6", "iPad2,7"):
        return "iPad mini (1st gen)"
    if model in ("iPad4,4", "iPad4,5", "iPad4,6"):
        return "iPad mini 2"
    if model in ("iPad4,7", "iPad4,8", "iPad4,9"):
        return "iPad mini 3"
    if model in ("iPad5,1", "iPad5,2"):
        return "iPad mini 4"
    if model in ("iPad11,1", "iPad11,2"):
        return "iPad mini (5th gen)"
    if model in ("iPad14,1", "iPad14,2"):
        return "iPad mini (6th gen)"
    if model in ("Watch1,1", "Watch1,2"):
        return "Apple Watch (1st gen)"
    if model in ("Watch2,6", "Watch2,7"):
        return "Apple Watch Series 1"
    if model in ("Watch2,3", "Watch2,4"):
        return "Apple Watch Series 2"
    if model in ("Watch3,1", "Watch3,2", "Watch3,3", "Watch3,4"):
        return "Apple Watch Series 3"
    if model in ("Watch4,1", "Watch4,2", "Watch4,3", "Watch4,4"):
        return "Apple Watch Series 4"
    if model in ("Watch5,1", "Watch5,2", "Watch5,3", "Watch5,4"):
        return "Apple Watch Series 5"
    if model in ("Watch5,9", "Watch5,10", "Watch5,11", "Watch5,12"):
        return "Apple Watch SE"
    if model in ("Watch6,3", "Watch6,4"):
        return "Apple Watch Series 6"
    if model in ("AppleTV1,1"):
        return "Apple TV (1st gen)"
    if model in ("AppleTV2,1"):
        return "Apple TV (2nd gen)"
    if model in ("AppleTV3,1", "AppleTV3,2"):
        return "Apple TV (3rd gen)"
    if model in ("AppleTV5,3"):
        return "Apple TV (4th gen)"
    if model in ("AppleTV6,2"):
        return "Apple TV 4K"
    if model in ("AppleTV11,1"):
        return "Apple TV 4K (2nd gen)"
    if model in ("i386"):
        return "iOS Simulator (i386)"
    if model in ("x86_64"):
        return "iOS Simulator (x86_64)"
    if model.startswith("iPhone"):
        return "Unknown iPhone"
    if model.startswith("iPad"):
        return "Unknown iPad"
    if model.startswith("AppleTV"):
        return "Unknown Apple TV"
    if model.startswith("Watch"):
        return "Unknown Apple Watch"
    return "Unknown iOS Device"


def ios_cpu_core_max_frequencies_mhz(model: str) -> List[int]:
    if model in ("iPhone1,1", "iPhone1,2", "iPod1,1"):
        return 412
    if model in ("Watch1,1", "Watch1,2"):
        return 520
    if model in ("iPod1,2"):
        return 533
    if model in ("iPhone2,1", "iPod3,1"):
        return 600
    if model in ("iPhone3,1", "iPhone3,2", "iPhone3,3", "iPod4,1", "iPhone4,1"):
        return 800
    if model in ("iPad1,1", "AppleTV1,1", "AppleTV2,1", "AppleTV3,1", "AppleTV3,2"):
        return 1000
    if model in (
        "Watch2,6",
        "Watch2,7",
        "Watch2,3",
        "Watch2,4",
        "Watch3,1",
        "Watch3,2",
        "Watch3,3",
        "Watch3,4",
        "Watch4,1",
        "Watch4,2",
        "Watch4,3",
        "Watch4,4",
        "Watch5,1",
        "Watch5,2",
        "Watch5,3",
        "Watch5,4",
    ):
        # The clock speeds for the Watch3,4,5 have not been published, we only
        # know that they are dual core 64-bit chips. Here we will assume that
        # they use the confirmed clock frequency from the Watch2, but in reality
        # they are likely higher.
        return (520, 520)
    if model in ("Watch5,9", "Watch5,10", "Watch5,11", "Watch5,12", "Watch6,3", "Watch6,4"):
        # Apple S6
        return (1800, 1800)
    if model in ("iPod5,1"):
        return (800, 800)
    if model in (
        "iPad2,1",
        "iPad2,2",
        "iPad2,3",
        "iPad2,4",
        "iPad2,5",
        "iPad2,6",
        "iPad2,7",
        "iPad3,1",
        "iPad3,2",
        "iPad3,3",
    ):
        return (1000, 1000)
    if model in ("iPod7,1"):
        return (1100, 1100)
    if model in (
        "iPhone5,1",
        "iPhone5,2",
        "iPhone5,3",
        "iPhone5,4",
        "iPhone6,1",
        "iPhone6,2",
        "iPad4,4",
        "iPad4,5",
        "iPad4,6",
        "iPad4,7",
        "iPad4,8",
        "iPad4,9",
    ):
        return (1300, 1300)
    if model in (
        "iPhone7,1",
        "iPhone7,2",
        "iPad3,4",
        "iPad3,5",
        "iPad3,6",
        "iPad4,1",
        "iPad4,2",
        "iPad4,3",
    ):
        return (1400, 1400)
    if model in ("iPad5,1", "iPad5,2", "AppleTV5,3"):
        return (1500, 1500)
    if model in ("iPod9,1"):
        return (1630, 1630)
    if model in ("iPad6,11", "iPad6,12"):
        return (1800, 1800)
    if model in ("iPhone8,1", "iPhone8,2", "iPhone8,4"):
        return (1850, 1850)
    if model in ("iPad6,3", "iPad6,4"):
        return (2160, 2160)
    if model in ("iPad6,7", "iPad6,8"):
        return (2260, 2260)
    if model in ("iPad7,11", "iPad7,12"):
        # SoC has 4 cores, but 2 are disabled
        return (2320, 2320)
    if model in ("iPad7,5", "iPad7,6", "iPhone9,1", "iPhone9,2", "iPhone9,3", "iPhone9,4"):
        # SoC has 4 cores, but 2 are disabled
        return (2340, 2340)
    if model in ("iPad5,3", "iPad5,4"):
        return (1500, 1500, 1500)
    if model in ("AppleTV6,2"):
        return (2380, 2380, 2380)
    if model in ("iPad7,1", "iPad7,2", "iPad7,3", "iPad7,4"):
        return (2380, 2380, 2380, 1300, 1300, 1300)
    if model in (
        "iPhone10,1",
        "iPhone10,2",
        "iPhone10,3",
        "iPhone10,4",
        "iPhone10,5",
        "iPhone10,6",
    ):
        return (2390, 2390, 1420, 1420, 1420, 1420)
    if model in (
        "iPad11,1",
        "iPad11,2",
        "iPad11,3",
        "iPad11,4",
        "iPad11,6",
        "iPad11,7",
        "iPhone11,2",
        "iPhone11,4",
        "iPhone11,6",
        "iPhone11,8",
        "AppleTV11,1",
    ):
        return (2490, 2490, 1587, 1587, 1587, 1587)
    if model in ("iPhone12,1", "iPhone12,3", "iPhone12,5", "iPhone12,8", "iPad12,1", "iPad12,2"):
        return (2650, 2650, 1600, 1600, 1600, 1600)
    if model in (
        "iPad8,1",
        "iPad8,2",
        "iPad8,3",
        "iPad8,4",
        "iPad8,5",
        "iPad8,6",
        "iPad8,7",
        "iPad8,8",
        "iPad8,9",
        "iPad8,10",
        "iPad8,11",
        "iPad8,12",
    ):
        return (2490, 2490, 2490, 2490, 1587, 1587, 1587, 1587)
    if model in ("iPhone13,1", "iPhone13,2", "iPhone13,3", "iPhone13,4", "iPad13,1", "iPad13,2"):
        return (3100, 3100, 1800, 1800, 1800, 1800)
    if model in ("iPhone14,2", "iPhone14,3", "iPhone14,4", "iPhone14,5"):
        # A15 Bionic
        return (3230, 3230, 1800, 1800, 1800, 1800)
    if model in ("iPad14,1", "iPad14,2"):
        # A15 Bionic (underclocked)
        return (2900, 2900, 1800, 1800, 1800, 1800)
    if model in (
        "iPad13,4",
        "iPad13,5",
        "iPad13,6",
        "iPad13,7",
        "iPad13,8",
        "iPad13,9",
        "iPad13,10",
        "iPad13,11",
    ):
        # M1
        return (3200, 3200, 3200, 3200, 2060, 2060, 2060, 2060)
    # New unreleased device, assume device is best of class */
    if model.startswith("iPhone"):
        return (3230, 3230, 1800, 1800, 1800, 1800)
    if model.startswith("iPad"):
        return (3200, 3200, 3200, 3200, 2060, 2060, 2060, 2060)
    if model.startswith("AppleTV"):
        return (2490, 2490, 1587, 1587, 1587, 1587)
    if model.startswith("Watch"):
        return (1800, 1800)
    return None  # unknown device
