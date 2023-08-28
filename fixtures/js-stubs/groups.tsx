import {Group} from 'fixtures/js-stubs/group';

import {Group as GroupType} from 'sentry/types';

export function Groups(): GroupType[] {
  return [Group(), Group()];
}
