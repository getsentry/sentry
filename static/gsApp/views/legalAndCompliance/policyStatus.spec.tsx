import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IconCheckmark} from 'sentry/icons';

import {PolicyStatus, StatusIconWithTooltip} from './policyStatus';

describe('PolicyStatus', function () {
  const policies = PoliciesFixture();

  it('renders checkmark when policy does not require signature', async function () {
    const policy = policies.pentest!;
    render(<PolicyStatus policy={policy} />);

    const icon = screen.getByRole('img', {hidden: true});
    await userEvent.hover(icon);

    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(await screen.findByText('Included with all accounts')).toBeInTheDocument();
  });

  it('renders checkmark with signature info when policy is signed', async function () {
    const policy = policies.terms!;
    render(<PolicyStatus policy={policy} />);

    const icon = screen.getByRole('img', {hidden: true});
    await userEvent.hover(icon);

    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(
      await screen.findByText(`Signed by ${policy.consent!.userEmail} on Jan 1, 2018`)
    ).toBeInTheDocument();
  });

  it('renders subtract icon when policy requires signature but is not signed', async function () {
    const policy = policies.dpa!;
    render(<PolicyStatus policy={policy} />);

    const icon = screen.getByRole('img', {hidden: true});
    await userEvent.hover(icon);

    expect(screen.getByTestId('icon-subtract')).toBeInTheDocument();
    expect(await screen.findByText('Optional, not signed')).toBeInTheDocument();
  });

  it('renders StatusIconWithTooltip component correctly', async function () {
    render(
      <StatusIconWithTooltip
        tooltip="Test tooltip"
        icon={<IconCheckmark isCircled size="sm" color="success" />}
      />
    );

    const icon = screen.getByRole('img', {hidden: true});
    await userEvent.hover(icon);

    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(await screen.findByText('Test tooltip')).toBeInTheDocument();
  });
});
