import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {ScmFeatureSelectionCards} from './scmFeatureSelectionCards';

const ALL_FEATURES = [
  ProductSolution.ERROR_MONITORING,
  ProductSolution.PERFORMANCE_MONITORING,
  ProductSolution.SESSION_REPLAY,
  ProductSolution.PROFILING,
  ProductSolution.LOGS,
  ProductSolution.METRICS,
];

describe('ScmFeatureSelectionCards', () => {
  it('renders all available features', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        onToggleFeature={jest.fn()}
      />
    );

    expect(screen.getByText('Error monitoring')).toBeInTheDocument();
    expect(screen.getByText('Tracing')).toBeInTheDocument();
    expect(screen.getByText('Session replay')).toBeInTheDocument();
    expect(screen.getByText('Profiling')).toBeInTheDocument();
    expect(screen.getByText('Logging')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });

  it('renders only passed features', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={[
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ]}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        onToggleFeature={jest.fn()}
      />
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('shows correct selected count', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
          ProductSolution.SESSION_REPLAY,
        ]}
        onToggleFeature={jest.fn()}
      />
    );

    expect(screen.getByText('3 of 6 selected')).toBeInTheDocument();
  });

  it('error monitoring card is always disabled', async () => {
    const onToggleFeature = jest.fn();

    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        onToggleFeature={onToggleFeature}
      />
    );

    const errorMonitoringCard = screen.getByRole('checkbox', {
      name: /Error monitoring/,
    });
    expect(errorMonitoringCard).toBeDisabled();

    await userEvent.click(errorMonitoringCard);
    expect(onToggleFeature).not.toHaveBeenCalled();
  });

  it('clicking a non-disabled feature calls onToggleFeature', async () => {
    const onToggleFeature = jest.fn();

    render(
      <ScmFeatureSelectionCards
        availableFeatures={[
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ]}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        onToggleFeature={onToggleFeature}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));
    expect(onToggleFeature).toHaveBeenCalledWith(ProductSolution.PERFORMANCE_MONITORING);
  });

  it('error monitoring checkbox is always checked', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[]}
        onToggleFeature={jest.fn()}
      />
    );

    const errorMonitoringCard = screen.getByRole('checkbox', {
      name: /Error monitoring/,
    });
    expect(errorMonitoringCard).toBeChecked();
  });
});
