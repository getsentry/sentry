import {OrganizationFixture} from 'sentry-fixture/organization';

import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PolicyRow} from 'getsentry/views/legalAndCompliance/policyRow';

// Build the javascript: URL via concatenation to avoid the no-script-url ESLint rule,
// which flags literal javascript: strings even inside test assertions.
const JS_URL = 'javascript' + ':alert(document.domain)';
const DANGEROUS_URLS = [
  JS_URL,
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
];

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

  describe('XSS prevention via URL scheme allowlist', () => {
    it.each(DANGEROUS_URLS)(
      'does not render a Review button when policy URL is "%s"',
      dangerousUrl => {
        const policy = {...policies.pentest!, url: dangerousUrl};
        render(
          <PolicyRow
            policies={{...policies, pentest: policy}}
            policy={policy}
            showUpdated={false}
            subscription={subscription}
            onAccept={() => {}}
          />
        );
        expect(screen.queryByRole('button', {name: 'Review'})).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', {name: 'Review and Accept'})
        ).not.toBeInTheDocument();
      }
    );

    it.each(DANGEROUS_URLS)(
      'does not render Review and Accept for billing user when policy URL is "%s"',
      dangerousUrl => {
        const orgWithBilling = OrganizationFixture({access: ['org:billing']});
        // soc-2-bridge-letter: hasSignature=true, slug is not privacy/terms — normally renders "Review and Accept"
        const policy = {...policies['soc-2-bridge-letter']!, url: dangerousUrl};
        render(
          <PolicyRow
            policies={{...policies, 'soc-2-bridge-letter': policy}}
            policy={policy}
            showUpdated={false}
            subscription={subscription}
            onAccept={() => {}}
          />,
          {organization: orgWithBilling}
        );
        expect(
          screen.queryByRole('button', {name: 'Review and Accept'})
        ).not.toBeInTheDocument();
      }
    );

    it.each(DANGEROUS_URLS)(
      'does not pass dangerous URL "%s" to window.open',
      dangerousUrl => {
        const windowOpenSpy = jest.spyOn(window, 'open').mockReturnValue(null);
        const orgWithBilling = OrganizationFixture({access: ['org:billing']});
        const policy = {...policies['soc-2-bridge-letter']!, url: dangerousUrl};
        render(
          <PolicyRow
            policies={{...policies, 'soc-2-bridge-letter': policy}}
            policy={policy}
            showUpdated={false}
            subscription={subscription}
            onAccept={() => {}}
          />,
          {organization: orgWithBilling}
        );
        // No button is rendered so showPolicy cannot be triggered
        expect(
          screen.queryByRole('button', {name: 'Review and Accept'})
        ).not.toBeInTheDocument();
        expect(windowOpenSpy).not.toHaveBeenCalled();
        windowOpenSpy.mockRestore();
      }
    );

    it('renders the Review button with a safe https href for a legitimate URL', () => {
      const policy = {...policies.terms!, url: 'https://sentry.io/legal/terms/1.0.0/'};
      render(
        <PolicyRow
          policies={{...policies, terms: policy}}
          policy={policy}
          showUpdated={false}
          subscription={subscription}
          onAccept={() => {}}
        />
      );
      const reviewButton = screen.getByRole('button', {name: 'Review'});
      expect(reviewButton).toBeInTheDocument();
      expect(reviewButton).toHaveAttribute(
        'href',
        'https://sentry.io/legal/terms/1.0.0/?userCurrentVersion=1.0.0'
      );
    });
  });
});
