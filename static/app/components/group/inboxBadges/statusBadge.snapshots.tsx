import {ThemeProvider} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';

import type {Group} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {getBadgeProperties} from './statusBadge';

const themes = {light: lightTheme, dark: darkTheme};

const cases: Array<{
  label: string;
  status: Group['status'];
  substatus: Group['substatus'];
}> = [
  {label: 'resolved', status: GroupStatus.RESOLVED, substatus: null},
  {label: 'new', status: GroupStatus.UNRESOLVED, substatus: GroupSubstatus.NEW},
  {
    label: 'regressed',
    status: GroupStatus.UNRESOLVED,
    substatus: GroupSubstatus.REGRESSED,
  },
  {
    label: 'escalating',
    status: GroupStatus.UNRESOLVED,
    substatus: GroupSubstatus.ESCALATING,
  },
  {label: 'ongoing', status: GroupStatus.UNRESOLVED, substatus: GroupSubstatus.ONGOING},
  {
    label: 'archived-forever',
    status: GroupStatus.IGNORED,
    substatus: GroupSubstatus.ARCHIVED_FOREVER,
  },
  {
    label: 'archived-until-escalating',
    status: GroupStatus.IGNORED,
    substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING,
  },
  {
    label: 'archived-until-condition',
    status: GroupStatus.IGNORED,
    substatus: GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET,
  },
];

describe('StatusBadge', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each(cases.map(c => c.label))(
      '%s',
      label => {
        const found = cases.find(c => c.label === label);
        const badge = found
          ? getBadgeProperties(found.status, found.substatus)
          : undefined;
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
      label => ({tags: {area: 'core', case: label}})
    );
  });
});
