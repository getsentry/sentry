function getPlatform(dataPlatform: any, platform: any) {
  // prioritize the frame platform but fall back to the platform
  // of the stacktrace / exception
  return dataPlatform || platform;
}

export default getPlatform;
