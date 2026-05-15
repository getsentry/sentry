import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {DisabledProducts} from 'sentry/components/onboarding/productSelection';

import {ScmFeatureSelectionCards} from './scmFeatureSelectionCards';
import {FALLBACK_FEATURE_META} from './useScmFeatureMeta';

const NO_DISABLED: DisabledProducts = {};

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
        disabledProducts={NO_DISABLED}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    expect(screen.getByText('Error monitoring')).toBeInTheDocument();
    expect(screen.getByText('Tracing')).toBeInTheDocument();
    expect(screen.getByText('Session replay')).toBeInTheDocument();
    expect(screen.getByText('Profiling')).toBeInTheDocument();
    expect(screen.getByText('Logging')).toBeInTheDocument();
    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
  });

  it('renders only passed features', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={[
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ]}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        disabledProducts={NO_DISABLED}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('error monitoring card is always disabled', async () => {
    const onToggleFeature = jest.fn();

    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        disabledProducts={NO_DISABLED}
        onToggleFeature={onToggleFeature}
        featureMeta={FALLBACK_FEATURE_META}
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
        disabledProducts={NO_DISABLED}
        onToggleFeature={onToggleFeature}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));
    expect(onToggleFeature).toHaveBeenCalledWith(ProductSolution.PERFORMANCE_MONITORING);
  });

  it('plan-disabled features render as disabled', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        disabledProducts={{
          [ProductSolution.SESSION_REPLAY]: {
            reason: 'Not available on your plan',
          },
          [ProductSolution.PROFILING]: {
            reason: 'Not available on your plan',
          },
        }}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    expect(screen.getByRole('checkbox', {name: /Session replay/})).toBeDisabled();
    expect(screen.getByRole('checkbox', {name: /Profiling/})).toBeDisabled();
    expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeEnabled();
  });

  it('error monitoring checkbox is always checked', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[]}
        disabledProducts={NO_DISABLED}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    const errorMonitoringCard = screen.getByRole('checkbox', {
      name: /Error monitoring/,
    });
    expect(errorMonitoringCard).toBeChecked();
  });

  it('renders volume strings from featureMeta', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        disabledProducts={NO_DISABLED}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
      />
    );

    expect(screen.getByText('5,000 errors / mo')).toBeInTheDocument();
    expect(screen.getByText('5M spans / mo')).toBeInTheDocument();
    expect(screen.getByText('Usage-based')).toBeInTheDocument();
  });

  it('renders skeletons in place of volume tags while loading', () => {
    render(
      <ScmFeatureSelectionCards
        availableFeatures={ALL_FEATURES}
        selectedFeatures={[ProductSolution.ERROR_MONITORING]}
        disabledProducts={NO_DISABLED}
        onToggleFeature={jest.fn()}
        featureMeta={FALLBACK_FEATURE_META}
        isVolumeLoading
      />
    );

    expect(screen.queryByText('5,000 errors / mo')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(
      ALL_FEATURES.length
    );
  });
});
