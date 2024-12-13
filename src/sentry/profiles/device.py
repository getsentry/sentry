from enum import Enum

GIB = 1024 * 1024 * 1024
UNKNOWN_DEVICE = "Unknown Device"


class DeviceClass(Enum):
    UNCLASSIFIED = 0
    LOW_END = 1
    MID_END = 2
    HIGH_END = 3

    def __str__(self) -> str:
        return {0: "unclassified", 1: "low", 2: "mid", 3: "high"}[self.value]


class Platform(Enum):
    UNKNOWN = 0
    IOS_DEVICE = 1
    IOS_SIMULATOR = 2
    ANDROID_DEVICE = 3
    ANDROID_EMULATOR = 4


# classify_device classifies a device as being low, mid, or high end
def classify_device(
    model: str,
    os_name: str,
    is_emulator: bool,
    cpu_frequencies: tuple[int] | None = None,
    physical_memory_bytes: int | None = None,
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
        if core_frequency(frequencies) < 3000:
            return DeviceClass.MID_END  # less than 3Ghz clock speed
        return DeviceClass.HIGH_END

    if platform == Platform.ANDROID_DEVICE and cpu_frequencies and physical_memory_bytes:
        if number_of_cores(cpu_frequencies) < 8 or physical_memory_bytes < (4 * GIB):
            return DeviceClass.LOW_END  # less than 8 cores or less than 4GiB of RAM
        if core_frequency(cpu_frequencies) < 2500:
            return DeviceClass.MID_END  # less than 2.5GHz clock speed
        return DeviceClass.HIGH_END

    return DeviceClass.UNCLASSIFIED


def number_of_cores(frequencies: tuple[int, ...] | None) -> int:
    return len(frequencies) if frequencies is not None else 0


def core_frequency(frequencies: tuple[int, ...] | None) -> int:
    return max(frequencies) if frequencies is not None else 0


def get_platform(device_os_name: str, is_emulator: bool) -> Platform:
    if device_os_name == "android":
        if is_emulator:
            return Platform.ANDROID_EMULATOR
        return Platform.ANDROID_DEVICE
    if device_os_name in ("iPhone OS", "iOS", "iPadOS", "watchOS", "tvOS"):
        if is_emulator:
            return Platform.IOS_SIMULATOR
        return Platform.IOS_DEVICE
    return Platform.UNKNOWN


IPHONE4 = "iPhone 4"
IPHONE5 = "iPhone 5"
IPHONE5C = "iPhone 5c"
IPHONE5S = "iPhone 5s"
IPHONE7 = "iPhone 7"
IPHONE7PLUS = "iPhone 7 Plus"
IPHONE8 = "iPhone 8"
IPHONE8PLUS = "iPhone 8 Plus"
IPHONEX = "iPhone X"
IPHONEXSMAX = "iPhone XS Max"

IPAD2 = "iPad 2"
IPADGEN3 = "iPad (3rd gen)"
IPADGEN4 = "iPad (4th gen)"
IPADGEN5 = "iPad (5th gen)"
IPADGEN6 = "iPad (6th gen)"
IPADGEN7 = "iPad (7th gen)"
IPADGEN8 = "iPad (8th gen)"
IPADGEN9 = "iPad (9th gen)"
IPADGEN10 = "iPad (10th gen)"

IPADAIRGEN1 = "iPad Air (1st gen)"
IPADAIR2 = "iPad Air 2"
IPADAIRGEN3 = "iPad Air (3rd gen)"
IPADAIRGEN4 = "iPad Air (4th gen)"
IPADAIRGEN5 = "iPad Air (5th gen)"
IPADAIRGEN6 = "iPad Air (6th gen)"
IPADAIRGEN7 = "iPad Air (7th gen)"

IPADPRO9GEN1 = "iPad Pro (9.7-inch)"
IPADPRO10 = "iPad Pro (10.5-inch)"
IPADPRO11GEN1 = "iPad Pro (11-inch, 1st gen)"
IPADPRO11GEN2 = "iPad Pro (11-inch, 2nd gen)"
IPADPRO11GEN3 = "iPad Pro (11-inch, 3rd gen)"
IPADPRO11GEN4 = "iPad Pro (11-inch, 4th gen)"
IPADPRO11GEN5 = "iPad Pro (11 inch, 5th gen)"
IPADPRO12GEN1 = "iPad Pro (12.9-inch, 1st gen)"
IPADPRO12GEN2 = "iPad Pro (12.9-inch, 2nd gen)"
IPADPRO12GEN3 = "iPad Pro (12.9-inch, 3rd gen)"
IPADPRO12GEN4 = "iPad Pro (12.9-inch, 4th gen)"
IPADPRO12GEN5 = "iPad Pro (12.9-inch, 5th gen)"
IPADPRO12GEN6 = "iPad Pro (12.9-inch, 6th gen)"
IPADPRO12GEN7 = "iPad Pro (12.9-inch, 7th gen)"

IPADMINIGEN1 = "iPad mini (1st gen)"
IPADMINI2 = "iPad mini 2"
IPADMINI3 = "iPad mini 3"
IPADMINI4 = "iPad mini 4"
IPADMINIGEN5 = "iPad mini (5th gen)"
IPADMINIGEN6 = "iPad mini (6th gen)"

APPLEWATCHGEN1 = "Apple Watch (1st gen)"
APPLEWATCHSERIES1 = "Apple Watch Series 1"
APPLEWATCHSERIES2 = "Apple Watch Series 2"
APPLEWATCHSERIES3 = "Apple Watch Series 3"
APPLEWATCHSERIES4 = "Apple Watch Series 4"
APPLEWATCHSERIES5 = "Apple Watch Series 5"
APPLEWATCHSERIES6 = "Apple Watch Series 6"
APPLEWATCHSERIES7 = "Apple Watch Series 7"
APPLEWATCHSERIES8 = "Apple Watch Series 8"
APPLEWATCHSERIES9 = "Apple Watch Series 9"
APPLEWATCHSERIES10 = "Apple Watch Series 10"
APPLEWATCHSE1 = "Apple Watch SE (1st gen)"
APPLEWATCHSE2 = "Apple Watch SE (2nd gen)"

APPLETVGEN1 = "Apple TV (1st gen)"
APPLETVGEN2 = "Apple TV (2nd gen)"
APPLETVGEN3 = "Apple TV (3rd gen)"

# see https://theapplewiki.com/wiki/models
IOS_MODELS: dict[str, str] = {
    # iPhone
    "iPhone1,1": "iPhone (1st gen)",
    "iPhone1,2": "iPhone 3G",
    "iPhone2,1": "iPhone 3GS",
    "iPhone3,1": IPHONE4,
    "iPhone3,2": IPHONE4,
    "iPhone3,3": IPHONE4,
    "iPhone4,1": "iPhone 4S",
    "iPhone5,1": IPHONE5,
    "iPhone5,2": IPHONE5,
    "iPhone5,3": IPHONE5C,
    "iPhone5,4": IPHONE5C,
    "iPhone6,1": IPHONE5S,
    "iPhone6,2": IPHONE5S,
    "iPhone7,2": "iPhone 6",
    "iPhone7,1": "iPhone 6 Plus",
    "iPhone8,1": "iPhone 6s",
    "iPhone8,2": "iPhone 6s Plus",
    "iPhone8,4": "iPhone SE (1st gen)",
    "iPhone9,1": IPHONE7,
    "iPhone9,3": IPHONE7,
    "iPhone9,2": IPHONE7PLUS,
    "iPhone9,4": IPHONE7PLUS,
    "iPhone10,1": IPHONE8,
    "iPhone10,4": IPHONE8,
    "iPhone10,2": IPHONE8PLUS,
    "iPhone10,5": IPHONE8PLUS,
    "iPhone10,3": IPHONEX,
    "iPhone10,6": IPHONEX,
    "iPhone11,8": "iPhone XR",
    "iPhone11,2": "iPhone XS",
    "iPhone11,4": IPHONEXSMAX,
    "iPhone11,6": IPHONEXSMAX,
    "iPhone12,1": "iPhone 11",
    "iPhone12,3": "iPhone 11 Pro",
    "iPhone12,5": "iPhone 11 Pro Max",
    "iPhone12,8": "iPhone SE (2nd gen)",
    "iPhone13,1": "iPhone 12 mini",
    "iPhone13,2": "iPhone 12",
    "iPhone13,3": "iPhone 12 Pro",
    "iPhone13,4": "iPhone 12 Pro Max",
    "iPhone14,4": "iPhone 13 mini",
    "iPhone14,5": "iPhone 13",
    "iPhone14,2": "iPhone 13 Pro",
    "iPhone14,3": "iPhone 13 Pro Max",
    "iPhone14,6": "iPhone SE (3rd gen)",
    "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus",
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 15",
    "iPhone15,5": "iPhone 15 Plus",
    "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone17,1": "iPhone 16 Pro",
    "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,3": "iPhone 16",
    "iPhone17,4": "iPhone 16 Plus",
    # iPod Touch
    "iPod1,1": "iPod touch (1st gen)",
    "iPod2,1": "iPod touch (2nd gen)",
    "iPod3,1": "iPod touch (3rd gen)",
    "iPod4,1": "iPod touch (4th gen)",
    "iPod5,1": "iPod touch (5th gen)",
    "iPod7,1": "iPod touch (6th gen)",
    "iPod9,1": "iPod touch (7th gen)",
    # iPad
    "iPad1,1": "iPad (1st gen)",
    "iPad2,1": IPAD2,
    "iPad2,2": IPAD2,
    "iPad2,3": IPAD2,
    "iPad2,4": IPAD2,
    "iPad3,1": IPADGEN3,
    "iPad3,2": IPADGEN3,
    "iPad3,3": IPADGEN3,
    "iPad3,4": IPADGEN4,
    "iPad3,5": IPADGEN4,
    "iPad3,6": IPADGEN4,
    "iPad6,11": IPADGEN5,
    "iPad6,12": IPADGEN5,
    "iPad7,5": IPADGEN6,
    "iPad7,6": IPADGEN6,
    "iPad7,11": IPADGEN7,
    "iPad7,12": IPADGEN7,
    "iPad11,6": IPADGEN8,
    "iPad11,7": IPADGEN8,
    "iPad12,1": IPADGEN9,
    "iPad12,2": IPADGEN9,
    # iPad Air
    "iPad4,1": IPADAIRGEN1,
    "iPad4,2": IPADAIRGEN1,
    "iPad4,3": IPADAIRGEN1,
    "iPad5,3": IPADAIR2,
    "iPad5,4": IPADAIR2,
    "iPad11,3": IPADAIRGEN3,
    "iPad11,4": IPADAIRGEN3,
    "iPad13,1": IPADAIRGEN4,
    "iPad13,2": IPADAIRGEN4,
    "iPad13,16": IPADAIRGEN5,
    "iPad13,17": IPADAIRGEN5,
    "iPad14,8": IPADAIRGEN6,
    "iPad14,9": IPADAIRGEN6,
    "iPad14,10": IPADAIRGEN7,
    "iPad14,11": IPADAIRGEN7,
    # iPad Pro
    "iPad6,7": IPADPRO12GEN1,
    "iPad6,3": IPADPRO9GEN1,
    "iPad6,4": IPADPRO9GEN1,
    "iPad6,8": IPADPRO12GEN1,
    "iPad7,1": IPADPRO12GEN2,
    "iPad7,2": IPADPRO12GEN2,
    "iPad7,3": IPADPRO10,
    "iPad7,4": IPADPRO10,
    "iPad8,1": IPADPRO11GEN1,
    "iPad8,2": IPADPRO11GEN1,
    "iPad8,3": IPADPRO11GEN1,
    "iPad8,4": IPADPRO11GEN1,
    "iPad8,5": IPADPRO12GEN3,
    "iPad8,6": IPADPRO12GEN3,
    "iPad8,7": IPADPRO12GEN3,
    "iPad8,8": IPADPRO12GEN3,
    "iPad8,9": IPADPRO11GEN2,
    "iPad8,10": IPADPRO11GEN2,
    "iPad8,11": IPADPRO12GEN4,
    "iPad8,12": IPADPRO12GEN4,
    "iPad13,4": IPADPRO11GEN3,
    "iPad13,5": IPADPRO11GEN3,
    "iPad13,6": IPADPRO11GEN3,
    "iPad13,7": IPADPRO11GEN3,
    "iPad13,8": IPADPRO12GEN5,
    "iPad13,9": IPADPRO12GEN5,
    "iPad13,10": IPADPRO12GEN5,
    "iPad13,11": IPADPRO12GEN5,
    "iPad14,3": IPADPRO11GEN4,
    "iPad14,4": IPADPRO11GEN4,
    "iPad14,5": IPADPRO12GEN6,
    "iPad14,6": IPADPRO12GEN6,
    "iPad16,3": IPADPRO11GEN5,
    "iPad16,4": IPADPRO11GEN5,
    "iPad16,5": IPADPRO12GEN7,
    "iPad16,6": IPADPRO12GEN7,
    # iPad Mini
    "iPad2,5": IPADMINIGEN1,
    "iPad2,6": IPADMINIGEN1,
    "iPad2,7": IPADMINIGEN1,
    "iPad4,4": IPADMINI2,
    "iPad4,5": IPADMINI2,
    "iPad4,6": IPADMINI2,
    "iPad4,7": IPADMINI3,
    "iPad4,8": IPADMINI3,
    "iPad4,9": IPADMINI3,
    "iPad5,1": IPADMINI4,
    "iPad5,2": IPADMINI4,
    "iPad11,1": IPADMINIGEN5,
    "iPad11,2": IPADMINIGEN5,
    "iPad13,18": IPADGEN10,
    "iPad13,19": IPADGEN10,
    "iPad14,1": IPADMINIGEN6,
    "iPad14,2": IPADMINIGEN6,
    # Apple Watch
    "Watch1,1": APPLEWATCHGEN1,
    "Watch1,2": APPLEWATCHGEN1,
    "Watch2,6": APPLEWATCHSERIES1,
    "Watch2,7": APPLEWATCHSERIES1,
    "Watch2,3": APPLEWATCHSERIES2,
    "Watch2,4": APPLEWATCHSERIES2,
    "Watch3,1": APPLEWATCHSERIES3,
    "Watch3,2": APPLEWATCHSERIES3,
    "Watch3,3": APPLEWATCHSERIES3,
    "Watch3,4": APPLEWATCHSERIES3,
    "Watch4,1": APPLEWATCHSERIES4,
    "Watch4,2": APPLEWATCHSERIES4,
    "Watch4,3": APPLEWATCHSERIES4,
    "Watch4,4": APPLEWATCHSERIES4,
    "Watch5,1": APPLEWATCHSERIES5,
    "Watch5,2": APPLEWATCHSERIES5,
    "Watch5,3": APPLEWATCHSERIES5,
    "Watch5,4": APPLEWATCHSERIES5,
    "Watch6,3": APPLEWATCHSERIES6,
    "Watch6,4": APPLEWATCHSERIES6,
    "Watch6,6": APPLEWATCHSERIES7,
    "Watch6,7": APPLEWATCHSERIES7,
    "Watch6,8": APPLEWATCHSERIES7,
    "Watch6,9": APPLEWATCHSERIES7,
    "Watch6,14": APPLEWATCHSERIES8,
    "Watch6,15": APPLEWATCHSERIES8,
    "Watch6,16": APPLEWATCHSERIES8,
    "Watch6,17": APPLEWATCHSERIES8,
    "Watch7,1": APPLEWATCHSERIES9,
    "Watch7,2": APPLEWATCHSERIES9,
    "Watch7,3": APPLEWATCHSERIES9,
    "Watch7,4": APPLEWATCHSERIES9,
    "Watch7,8": APPLEWATCHSERIES10,
    "Watch7,9": APPLEWATCHSERIES10,
    "Watch7,10": APPLEWATCHSERIES10,
    "Watch7,11": APPLEWATCHSERIES10,
    # Apple Watch SE
    "Watch5,9": APPLEWATCHSE1,
    "Watch5,10": APPLEWATCHSE1,
    "Watch5,11": APPLEWATCHSE1,
    "Watch5,12": APPLEWATCHSE1,
    "Watch6,10": APPLEWATCHSE2,
    "Watch6,11": APPLEWATCHSE2,
    "Watch6,12": APPLEWATCHSE2,
    "Watch6,13": APPLEWATCHSE2,
    # Apple Watch Ultra
    "Watch6,18": "Apple Watch Ultra (1st gen)",
    "Watch7,5": "Apple Watch Ultra (2nd gen)",
    # Apple TV
    "AppleTV1,1": "Apple TV (1st gen)",
    "AppleTV2,1": "Apple TV (2nd gen)",
    "AppleTV3,1": APPLETVGEN3,
    "AppleTV3,2": APPLETVGEN3,
    "AppleTV5,3": "Apple TV (4th gen)",
    "AppleTV6,2": "Apple TV 4K",
    "AppleTV11,1": "Apple TV 4K (2nd gen)",
    "i386": "iOS Simulator (i386)",
    "x86_64": "iOS Simulator (x86_64)",
}

CPU1 = (520, 520)
CPU2 = (1000, 1000)
CPU3 = (1300, 1300)
CPU4 = (1400, 1400)
CPU5 = (1500, 1500)
CPU6 = (1800, 1800)
CPU7 = (1850, 1850)
CPU8 = (2160, 2160)
CPU9 = (2260, 2260)
CPU10 = (2320, 2320)
CPU11 = (2340, 2340)
CPU12 = (1500, 1500, 1500)
CPU13 = (2380, 2380, 2380, 1300, 1300, 1300)
CPU14 = (2390, 2390, 1420, 1420, 1420, 1420)
CPU15 = (2490, 2490, 1587, 1587, 1587, 1587)
CPU16 = (2650, 2650, 1600, 1600, 1600, 1600)
CPU17 = (2490, 2490, 2490, 2490, 1587, 1587, 1587, 1587)
CPU18 = (3100, 3100, 1800, 1800, 1800, 1800)
CPU19 = (3230, 3230, 1800, 1800, 1800, 1800)
CPU20 = (2900, 2900, 1800, 1800, 1800, 1800)
CPU21 = (3200, 3200, 3200, 3200, 2060, 2060, 2060, 2060)
CPU22 = (3230, 3230, 2020, 2020, 2020, 2020)
CPU23 = (3460, 3460, 2020, 2020, 2020, 2020)


IOS_CPU_FREQUENCIES: dict[str, tuple[int, ...]] = {
    "iPhone1,1": (412,),
    "iPhone1,2": (412,),
    "iPod1,1": (412,),
    "Watch1,1": (520,),
    "Watch1,2": (520,),
    "iPod1,2": (533,),
    "iPhone2,1": (600,),
    "iPod3,1": (600,),
    "iPhone3,1": (800,),
    "iPhone3,2": (800,),
    "iPhone3,3": (800,),
    "iPod4,1": (800,),
    "iPhone4,1": (800,),
    "iPad1,1": (1000,),
    "AppleTV1,1": (1000,),
    "AppleTV2,1": (1000,),
    "AppleTV3,1": (1000,),
    "AppleTV3,2": (1000,),
    "Watch2,6": CPU1,
    "Watch2,7": CPU1,
    "Watch2,3": CPU1,
    "Watch2,4": CPU1,
    # The clock speeds for the Watch3,4,5 have not been published, we only
    # know that they are dual core 64-bit chips. Here we will assume that
    # they use the confirmed clock frequency from the Watch2, but in reality
    # they are likely higher.
    "Watch3,1": CPU1,
    "Watch3,2": CPU1,
    "Watch3,3": CPU1,
    "Watch3,4": CPU1,
    "Watch4,1": CPU1,
    "Watch4,2": CPU1,
    "Watch4,3": CPU1,
    "Watch4,4": CPU1,
    "Watch5,1": CPU1,
    "Watch5,2": CPU1,
    "Watch5,3": CPU1,
    "Watch5,4": CPU1,
    "Watch5,9": CPU2,
    "Watch5,10": CPU2,
    "Watch5,11": CPU2,
    "Watch5,12": CPU2,
    "Watch6,3": CPU2,
    "Watch6,4": CPU2,
    "iPod5,1": (800, 800),
    "iPad2,1": CPU2,
    "iPad2,2": CPU2,
    "iPad2,3": CPU2,
    "iPad2,4": CPU2,
    "iPad2,5": CPU2,
    "iPad2,6": CPU2,
    "iPad2,7": CPU2,
    "iPad3,1": CPU2,
    "iPad3,2": CPU2,
    "iPad3,3": CPU2,
    "iPod7,1": (1100, 1100),
    "iPhone5,1": CPU3,
    "iPhone5,2": CPU3,
    "iPhone5,3": CPU3,
    "iPhone5,4": CPU3,
    "iPhone6,1": CPU3,
    "iPhone6,2": CPU3,
    "iPad4,4": CPU3,
    "iPad4,5": CPU3,
    "iPad4,6": CPU3,
    "iPad4,7": CPU3,
    "iPad4,8": CPU3,
    "iPad4,9": CPU3,
    "iPhone7,1": CPU4,
    "iPhone7,2": CPU4,
    "iPad3,4": CPU4,
    "iPad3,5": CPU4,
    "iPad3,6": CPU4,
    "iPad4,1": CPU4,
    "iPad4,2": CPU4,
    "iPad4,3": CPU4,
    "iPad5,1": CPU5,
    "iPad5,2": CPU5,
    "AppleTV5,3": CPU5,
    "iPod9,1": (1630, 1630),
    "iPad6,11": CPU6,
    "iPad6,12": CPU6,
    "iPhone8,1": CPU7,
    "iPhone8,2": CPU7,
    "iPhone8,4": CPU7,
    "iPad6,3": CPU8,
    "iPad6,4": CPU8,
    "iPad6,7": CPU9,
    "iPad6,8": CPU9,
    "iPad7,11": CPU10,
    "iPad7,12": CPU10,
    "iPad7,5": CPU11,
    "iPad7,6": CPU11,
    "iPhone9,1": CPU11,
    "iPhone9,2": CPU11,
    "iPhone9,3": CPU11,
    "iPhone9,4": CPU11,
    "iPad5,3": CPU12,
    "iPad5,4": CPU12,
    "AppleTV6,2": (2380, 2380, 2380),
    "iPad7,1": CPU13,
    "iPad7,2": CPU13,
    "iPad7,3": CPU13,
    "iPad7,4": CPU13,
    "iPhone10,1": CPU14,
    "iPhone10,2": CPU14,
    "iPhone10,3": CPU14,
    "iPhone10,4": CPU14,
    "iPhone10,5": CPU14,
    "iPhone10,6": CPU14,
    "iPad11,1": CPU15,
    "iPad11,2": CPU15,
    "iPad11,3": CPU15,
    "iPad11,4": CPU15,
    "iPad11,6": CPU15,
    "iPad11,7": CPU15,
    "iPhone11,2": CPU15,
    "iPhone11,4": CPU15,
    "iPhone11,6": CPU15,
    "iPhone11,8": CPU15,
    "AppleTV11,1": CPU15,
    "iPhone12,1": CPU16,
    "iPhone12,3": CPU16,
    "iPhone12,5": CPU16,
    "iPhone12,8": CPU16,
    "iPad12,1": CPU16,
    "iPad12,2": CPU16,
    "iPad8,1": CPU17,
    "iPad8,2": CPU17,
    "iPad8,3": CPU17,
    "iPad8,4": CPU17,
    "iPad8,5": CPU17,
    "iPad8,6": CPU17,
    "iPad8,7": CPU17,
    "iPad8,8": CPU17,
    "iPad8,9": CPU17,
    "iPad8,10": CPU17,
    "iPad8,11": CPU17,
    "iPad8,12": CPU17,
    "iPhone13,1": CPU18,
    "iPhone13,2": CPU18,
    "iPhone13,3": CPU18,
    "iPhone13,4": CPU18,
    "iPad13,1": CPU18,
    "iPad13,2": CPU18,
    "iPhone14,2": CPU19,
    "iPhone14,3": CPU19,
    "iPhone14,4": CPU19,
    "iPhone14,5": CPU19,
    "iPad14,1": CPU20,
    "iPad14,2": CPU20,
    "iPad13,4": CPU21,
    "iPad13,5": CPU21,
    "iPad13,6": CPU21,
    "iPad13,7": CPU21,
    "iPad13,8": CPU21,
    "iPad13,9": CPU21,
    "iPad13,10": CPU21,
    "iPad13,11": CPU21,
    "iPhone14,6": CPU19,
    "iPhone14,7": CPU22,
    "iPhone14,8": CPU22,
    "iPhone15,2": CPU23,
    "iPhone15,3": CPU23,
}


def ios_cpu_core_max_frequencies_mhz(model: str) -> tuple[int, ...] | None:
    if model in IOS_CPU_FREQUENCIES:
        return IOS_CPU_FREQUENCIES[model]
    # New unreleased device, assume device is best of class */
    if model.startswith("iPhone"):
        return CPU19
    if model.startswith("iPad"):
        return CPU21
    if model.startswith("AppleTV"):
        return CPU15
    if model.startswith("Watch"):
        return CPU6
    return None  # unknown device
