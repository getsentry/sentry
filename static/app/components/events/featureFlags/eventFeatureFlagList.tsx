// {
//         "event_id": "0a52a8331d3b45089ebd74f8118d4fa1",
//         "release": "io.sentry.samples.android@7.4.0+2",
//         "dist": "2",
//         "platform": "java",
//         "environment": "debug",
//         "exception": {
//             "values": [
//                 {
//                     "type": "IllegalArgumentException",
//                     "value": "SDK Crash",
//                     "module": "java.lang",
//                     "stacktrace": {"frames": frames},
//                     "mechanism": {"type": "onerror", "handled": False},
//                 }
//             ]
//         },
//         "key_id": "1336851",
//         "level": "fatal",
//         "contexts": {
//             "device": {
//                 "name": "sdk_gphone64_arm64",
//                 "family": "sdk_gphone64_arm64",
//                 "model": "sdk_gphone64_arm64",
//                 "simulator": True,
//             },
//             "os": {
//                 "name": "Android",
//                 "version": "13",
//                 "build": "sdk_gphone64_arm64-userdebug UpsideDownCake UPB2.230407.019 10170211 dev-keys",
//                 "kernel_version": "6.1.21-android14-3-01811-g9e35a21ec03f-ab9850788",
//                 "rooted": False,
//                 "type": "os",
//             },
//         },
//         "sdk": {"name": "sentry.java.android", "version": "7.4.0"},
//         "timestamp": time.time(),
//         "type": "error",
//     }

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

export function EventFeatureFlagList({_event}: {_event: Event}) {
  // const flags = event.contexts?.flags;

  // TODO: remove
  const organization = useOrganization();
  const flags = organization.features.map(f => {
    return {flag: f, result: true};
  });

  if (!flags || !flags.length) {
    return null;
  }

  return (
    <EventDataSection title="Feature Flags" type="feature-flags">
      test
    </EventDataSection>
  );
}
