import {OrganizationFixture} from 'sentry-fixture/organization';

import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PolicyRow} from 'getsentry/views/legalAndCompliance/policyRow';

describe('PolicyRow', () => {
  const {organization} = initializeOrg({});
  const subscription = SubscriptionFixture({organization});
  const policies = PoliciesFixture();

  it('renders with consent, requires signature, and version match', () => {
    const policy = policies.terms!;
    render(
      <PolicyRow
        key="privacy"
        policies={policies}
        policy={policy}
        showUpdated={false}
        subscription={subscription}
        onAccept={() => {}}
      />
    );
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.queryByText(/Updated on/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review'})).toHaveAttribute(
      'href',
      'https://sentry.io/legal/terms/1.0.0/?userCurrentVersion=1.0.0'
    );
  });

  it('does not require signature', () => {
    const policy = policies.pentest!;
    render(
      <PolicyRow
        key="privacy"
        policies={policies}
        policy={policy}
        showUpdated={false}
        subscription={subscription}
        onAccept={() => {}}
      />
    );
    expect(screen.getByText(policy.name)).toBeInTheDocument();
    expect(screen.queryByText(/signed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/New version available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review'})).toBeInTheDocument();
  });

  it('does not require signature and show updated', () => {
    const policy = policies.pentest!;
    render(
      <PolicyRow
        key="privacy"
        policies={policies}
        policy={policy}
        showUpdated
        subscription={subscription}
        onAccept={() => {}}
      />
    );
    expect(screen.getByText(policy.name)).toBeInTheDocument();
    expect(screen.queryByText(/signed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated on/i)).toBeInTheDocument();
    expect(screen.queryByText(/New version available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review'})).toBeInTheDocument();
  });

  it('allows org members to view policies', () => {
    const policy = policies['soc-2-bridge-letter']!;
    const modifiedOrganization = OrganizationFixture({
      access: [],
    });

    render(
      <PolicyRow
        key="soc-2-bridge-letter"
        policies={policies}
        policy={policy}
        showUpdated
        subscription={subscription}
        onAccept={() => {}}
      />,
      {organization: modifiedOrganization}
    );

    expect(screen.getByText(policy.name)).toBeInTheDocument();
    expect(screen.queryByText(/signed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated on/i)).toBeInTheDocument();
    expect(screen.queryByText(/New version available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review'})).toBeInTheDocument();
  });
  it('allows those with org write to accept policies', () => {
    const policy = policies['soc-2-bridge-letter']!;
    const modifiedOrganization = OrganizationFixture({
      access: ['org:billing'],
    });

    render(
      <PolicyRow
        key="soc-2-bridge-letter"
        policies={policies}
        policy={policy}
        showUpdated
        subscription={subscription}
        onAccept={() => {}}
      />,
      {organization: modifiedOrganization}
    );

    expect(screen.getByText(policy.name)).toBeInTheDocument();
    expect(screen.queryByText(/signed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated on/i)).toBeInTheDocument();
    expect(screen.queryByText(/New version available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review and Accept'})).toBeInTheDocument();
  });
});
