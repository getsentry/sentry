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
