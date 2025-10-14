import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PlanFeatures from 'getsentry/views/amCheckout/components/planFeatures';

describe('PlanFeatures', () => {
  const freePlan = PlanDetailsLookupFixture('am3_f')!;
  const teamPlan = PlanDetailsLookupFixture('am3_team')!;
  const businessPlan = PlanDetailsLookupFixture('am3_business')!;
  const planOptions = [freePlan, teamPlan, businessPlan];

  it('renders the plan features based on free plan', () => {
    render(<PlanFeatures planOptions={planOptions} activePlan={freePlan} />);

    expect(screen.getByText(/What you get on the/)).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByTestId('developer-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('team-features-excluded')).toBeInTheDocument();
    expect(screen.getByTestId('business-features-excluded')).toBeInTheDocument();
  });

  it('renders the plan features based on team plan', () => {
    render(<PlanFeatures planOptions={planOptions} activePlan={teamPlan} />);

    expect(screen.getByText(/What you get on the/)).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByTestId('developer-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('team-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('business-features-excluded')).toBeInTheDocument();
  });

  it('renders the plan features based on business plan', () => {
    render(<PlanFeatures planOptions={planOptions} activePlan={businessPlan} />);

    expect(screen.getByText(/What you get on the/)).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByTestId('developer-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('team-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('business-features-included')).toBeInTheDocument();
    expect(screen.getByText(/Excess usage for/)).toBeInTheDocument();
  });

  it('excludes features that are not in specified plans', () => {
    render(<PlanFeatures planOptions={planOptions.slice(1)} activePlan={teamPlan} />);

    expect(screen.getByTestId('team-features-included')).toBeInTheDocument();
    expect(screen.getByTestId('business-features-excluded')).toBeInTheDocument();

    // free plan not included in planOptions
    expect(screen.queryByTestId('developer-features-excluded')).not.toBeInTheDocument();
  });
});
