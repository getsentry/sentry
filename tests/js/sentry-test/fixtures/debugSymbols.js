export function DebugSymbols(params) {
  return {
    debugSymbols: [
      {
        dateCreated: '2018-01-31T07:16:26.072Z',
        dsym: {
          headers: {'Content-Type': 'text/x-proguard+plain'},
          sha1: 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44',
          uuid: '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1',
          objectName: 'proguard-mapping',
          dateCreated: '2018-01-31T07:16:26.010Z',
          cpuName: 'any',
          id: '1',
          symbolType: 'proguard',
          size: 212,
        },
        dsymAppId: 1,
        version: '1.0',
        build: '1',
        id: '1',
      },
    ],
    unreferencedDebugSymbols: [],
    apps: [
      {
        lastSync: '2018-01-31T07:16:26.070Z',
        name: 'MyApp',
        iconUrl: null,
        platforms: '',
        platform: 'android',
        appId: 'com.example.myapp',
        id: '1',
      },
    ],
    ...params,
  };
}
