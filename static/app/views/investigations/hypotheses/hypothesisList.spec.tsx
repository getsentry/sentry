import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {
  InvestigationHypothesesFixture,
  InvestigationHypothesisFixture,
} from 'sentry/views/investigations/fixtures';
import {HypothesisList} from 'sentry/views/investigations/hypotheses/hypothesisList';

describe('HypothesisList', () => {
  it('renders one card per hypothesis', () => {
    render(<HypothesisList hypotheses={InvestigationHypothesesFixture()} />);

    expect(screen.getAllByTestId('investigation-hypothesis')).toHaveLength(3);
    expect(
      screen.getByRole('heading', {
        name: 'Database or cache degradation delayed the response',
      })
    ).toBeInTheDocument();
  });

  it('orders cards by the projection order, not array position', () => {
    render(
      <HypothesisList
        hypotheses={[
          InvestigationHypothesisFixture({
            id: 'last',
            order: 2,
            statement: 'Third idea',
            verificationSteps: [],
          }),
          InvestigationHypothesisFixture({
            id: 'first',
            order: 0,
            statement: 'First idea',
            verificationSteps: [],
          }),
        ]}
      />
    );

    const cards = within(screen.getByTestId('investigation-hypotheses')).getAllByTestId(
      'investigation-hypothesis'
    );
    expect(cards[0]).toHaveTextContent('First idea');
    expect(cards[1]).toHaveTextContent('Third idea');
  });

  it('renders nothing when there are no hypotheses', () => {
    render(<HypothesisList hypotheses={[]} />);

    expect(screen.queryByTestId('investigation-hypotheses')).not.toBeInTheDocument();
  });

  it('marks the report primary hypothesis', () => {
    render(
      <HypothesisList
        hypotheses={InvestigationHypothesesFixture()}
        primaryHypothesisId="hypothesis-2"
      />
    );

    const cards = screen.getAllByTestId('investigation-hypothesis');
    expect(cards[0]).toHaveAttribute('data-primary', 'false');
    expect(cards[1]).toHaveAttribute('data-primary', 'true');
  });

  it('passes per-hypothesis actions to each card', async () => {
    render(
      <HypothesisList
        hypotheses={InvestigationHypothesesFixture()}
        getActions={hypothesis => [
          {key: 'retry', label: `Retry ${hypothesis.id}`, onAction: jest.fn()},
        ]}
      />
    );

    expect(await screen.findAllByRole('button', {name: /Actions for/})).toHaveLength(3);
  });
});
