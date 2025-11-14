import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PlanFeatures from 'getsentry/views/amCheckout/components/planFeatures';

describe('PlanFeatures', () => {
  const freePlan = PlanDetailsLookupFixture('am3_f')!;
  const teamPlan = PlanDetailsLookupFixture('am3_team')!;
  const businessPlan = PlanDetailsLookupFixture('am3_business')!;
  const planOptions = [freePlan, teamPlan, businessPlan];

  it('renders for team plan', () => {
    render(<PlanFeatures planOptions={planOptions} activePlan={teamPlan} />);

    expect(screen.getByText('MONITORING & DATA')).toBeInTheDocument();
    expect(screen.getByText('EXPANSION PACK')).toBeInTheDocument();
    expect(screen.getAllByText(/on Business only/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Excess usage for/)).toBeInTheDocument();
  });

  it('renders for business plan', () => {
    render(<PlanFeatures planOptions={planOptions} activePlan={businessPlan} />);

    expect(screen.getByText('MONITORING & DATA')).toBeInTheDocument();
    expect(screen.getByText('EXPANSION PACK')).toBeInTheDocument();
    expect(screen.queryByText(/on Business only/)).not.toBeInTheDocument();
    expect(screen.getByText(/Excess usage for/)).toBeInTheDocument();
  });
});
