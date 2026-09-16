import {ThemeProvider} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';

import {GroupSubstatus} from 'sentry/types/group';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {getBadgeProperties} from './statusBadge';

const themes = {light: lightTheme, dark: darkTheme};

const cases: Array<{
  label: string;
  status: string;
  substatus: GroupSubstatus | null;
}> = [
  {label: 'resolved', status: 'resolved', substatus: null},
  {label: 'new', status: 'unresolved', substatus: GroupSubstatus.NEW},
  {label: 'regressed', status: 'unresolved', substatus: GroupSubstatus.REGRESSED},
  {label: 'escalating', status: 'unresolved', substatus: GroupSubstatus.ESCALATING},
  {label: 'ongoing', status: 'unresolved', substatus: GroupSubstatus.ONGOING},
  {
    label: 'archived-forever',
    status: 'ignored',
    substatus: GroupSubstatus.ARCHIVED_FOREVER,
  },
  {
    label: 'archived-until-escalating',
    status: 'ignored',
    substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING,
  },
  {
    label: 'archived-until-condition',
    status: 'ignored',
    substatus: GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET,
  },
];

describe('StatusBadge', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each(cases.map(c => c.label))(
      '%s',
      label => {
        const {status, substatus} = cases.find(c => c.label === label)!;
        const badge = getBadgeProperties(status as any, substatus);
        if (!badge) {
          return (
            <ThemeProvider theme={themes[themeName]}>
              <div style={{padding: 8}}>{'(no badge)'}</div>
            </ThemeProvider>
          );
        }
        return (
          <ThemeProvider theme={themes[themeName]}>
            <div style={{padding: 8}}>
              <Tag variant={badge.tagVariant}>{badge.status}</Tag>
            </div>
          </ThemeProvider>
        );
      },
      label => ({theme: themeName, case: label})
    );
  });
});
