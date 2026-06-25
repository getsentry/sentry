import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_ISSUE_ALERT_OPTIONS_VALUES} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequencySection} from './scmAlertFrequencySection';

type Props = React.ComponentProps<typeof ScmAlertFrequencySection>;

function renderSection(overrides: Partial<Props> = {}) {
  const props: Props = {
    analyticsFlow: 'project-creation',
    alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
    onAlertChange: jest.fn(),
    ...overrides,
  };

  render(<ScmAlertFrequencySection {...props} />, {organization: OrganizationFixture()});
  return props;
}

describe('ScmAlertFrequencySection', () => {
  it('makes the alert-frequency section a collapsible toggle in project creation', async () => {
    renderSection({analyticsFlow: 'project-creation'});

    const toggle = screen.getByRole('button', {name: 'Alert frequency'});
    expect(screen.getByText('Get notified when things go wrong')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(
      screen.queryByText('Get notified when things go wrong')
    ).not.toBeInTheDocument();
  });

  it('keeps the alert-frequency section always expanded in onboarding', () => {
    renderSection({analyticsFlow: 'onboarding'});

    expect(
      screen.queryByRole('button', {name: 'Alert frequency'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Alert frequency')).toBeInTheDocument();
    expect(screen.getByText('Get notified when things go wrong')).toBeInTheDocument();
  });
});
