/* global process */
// jest snapshot serializer for emotion
import {sheet} from 'emotion';
import serializer from 'jest-glamor-react';

expect.addSnapshotSerializer(serializer(sheet));
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});
