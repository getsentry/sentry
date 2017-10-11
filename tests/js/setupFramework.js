// jest snapshot serializer for emotion
import {sheet} from 'emotion';
import serializer from 'jest-glamor-react';

expect.addSnapshotSerializer(serializer(sheet));
