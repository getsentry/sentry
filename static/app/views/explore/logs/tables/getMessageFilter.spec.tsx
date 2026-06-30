import {LogFixture} from 'sentry-fixture/log';

import {getMessageFilter} from 'sentry/views/explore/logs/tables/getMessageFilter';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

describe('getMessageFilter', () => {
  const baseRow = LogFixture({
    [OurLogKnownFieldKey.ID]: '1',
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
  });

  it('uses the message template when filtering on the message field and a template is available', () => {
    const row = {
      ...baseRow,
      [OurLogKnownFieldKey.MESSAGE]: 'User 123 logged in',
      [OurLogKnownFieldKey.TEMPLATE]: 'User {id} logged in',
    };

    const filter = getMessageFilter(
      OurLogKnownFieldKey.MESSAGE,
      row,
      'User 123 logged in'
    );

    expect(filter).toEqual({
      key: OurLogKnownFieldKey.TEMPLATE,
      value: 'User {id} logged in',
    });
  });

  it('uses the message value when filtering on the message field and no template is available', () => {
    const row = {
      ...baseRow,
      [OurLogKnownFieldKey.MESSAGE]: 'User 123 logged in',
    };

    const filter = getMessageFilter(
      OurLogKnownFieldKey.MESSAGE,
      row,
      'User 123 logged in'
    );

    expect(filter).toEqual({
      key: OurLogKnownFieldKey.MESSAGE,
      value: 'User 123 logged in',
    });
  });

  it('uses the field and cell value when filtering on a non-message field', () => {
    const row = {
      ...baseRow,
      [OurLogKnownFieldKey.TEMPLATE]: 'User {id} logged in',
    };

    const filter = getMessageFilter(OurLogKnownFieldKey.SEVERITY, row, 'error');

    expect(filter).toEqual({
      key: OurLogKnownFieldKey.SEVERITY,
      value: 'error',
    });
  });
});
