import {parseAutomationOwner} from 'sentry/views/automations/components/automationListTable/assigneeCell';

describe('parseAutomationOwner', () => {
  it('parses a user identifier', () => {
    expect(parseAutomationOwner('user:1')).toEqual({type: 'user', id: '1'});
  });

  it('parses a team identifier', () => {
    expect(parseAutomationOwner('team:1')).toEqual({type: 'team', id: '1'});
  });

  it('returns null when there is no owner', () => {
    expect(parseAutomationOwner(null)).toBeNull();
    expect(parseAutomationOwner('')).toBeNull();
  });

  it('returns null when the type or id is missing', () => {
    expect(parseAutomationOwner('user')).toBeNull();
    expect(parseAutomationOwner('user:')).toBeNull();
    expect(parseAutomationOwner(':1')).toBeNull();
    expect(parseAutomationOwner(':')).toBeNull();
  });

  it('returns null for an unrecognized actor type', () => {
    expect(parseAutomationOwner('organization:1')).toBeNull();
    expect(parseAutomationOwner('Team:1')).toBeNull();
  });
});
