import {useEffect} from 'react';
import styled from '@emotion/styled';

import performanceEmptyState from 'sentry-images/spot/performance-empty-state.svg';
// Import the actual SVG images
import profilingEmptyState from 'sentry-images/spot/profiling-empty-state.svg';
import replayEmptyState from 'sentry-images/spot/replays-empty-state.svg';
import waitingForEvent from 'sentry-images/spot/waiting-for-event.svg';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  CardRendererProps,
  TypedMissionControlCard,
} from 'sentry/types/missionControl';

// Available Sentry products for instrumentation
export enum InstrumentationProduct {
  TRACING = 'tracing',
  PROFILING = 'profiling',
  UPTIME = 'uptime',
  PERFORMANCE = 'performance',
  ERRORS = 'errors',
  REPLAY = 'replay',
  CRONS = 'crons',
}

// Map products to their SVG illustrations
const PRODUCT_ILLUSTRATIONS: Record<InstrumentationProduct, string> = {
  [InstrumentationProduct.TRACING]: performanceEmptyState,
  [InstrumentationProduct.PROFILING]: profilingEmptyState,
  [InstrumentationProduct.UPTIME]: waitingForEvent, // Using waiting-for-event as placeholder for uptime
  [InstrumentationProduct.PERFORMANCE]: performanceEmptyState,
  [InstrumentationProduct.ERRORS]: waitingForEvent,
  [InstrumentationProduct.REPLAY]: replayEmptyState,
  [InstrumentationProduct.CRONS]: waitingForEvent, // Using waiting-for-event as placeholder for crons
};

// Display names for products
const PRODUCT_NAMES: Record<InstrumentationProduct, string> = {
  [InstrumentationProduct.TRACING]: 'Tracing',
  [InstrumentationProduct.PROFILING]: 'Profiling',
  [InstrumentationProduct.UPTIME]: 'Uptime Monitoring',
  [InstrumentationProduct.PERFORMANCE]: 'Performance Monitoring',
  [InstrumentationProduct.ERRORS]: 'Error Monitoring',
  [InstrumentationProduct.REPLAY]: 'Session Replay',
  [InstrumentationProduct.CRONS]: 'Cron Monitoring',
};

// Documentation URLs for each product
const PRODUCT_DOCS: Record<InstrumentationProduct, string> = {
  [InstrumentationProduct.TRACING]:
    'https://docs.sentry.io/product/sentry-basics/tracing/',
  [InstrumentationProduct.PROFILING]: 'https://docs.sentry.io/product/profiling/',
  [InstrumentationProduct.UPTIME]: 'https://docs.sentry.io/product/uptime-monitoring/',
  [InstrumentationProduct.PERFORMANCE]: 'https://docs.sentry.io/product/performance/',
  [InstrumentationProduct.ERRORS]: 'https://docs.sentry.io/product/issues/',
  [InstrumentationProduct.REPLAY]: 'https://docs.sentry.io/product/session-replay/',
  [InstrumentationProduct.CRONS]: 'https://docs.sentry.io/product/crons/',
};

interface MissingInstrumentationCardData {
  description: string;
  products: InstrumentationProduct[];
}

type MissingInstrumentationCard = TypedMissionControlCard<
  'missing-instrumentation',
  MissingInstrumentationCardData
>;

function MissingInstrumentationCardRenderer({
  card,
  onSetPrimaryAction,
}: CardRendererProps<MissingInstrumentationCardData>) {
  const {description, products} = card.data;

  useEffect(() => {
    // Set up the primary action to start instrumentation setup
    onSetPrimaryAction({
      label: 'Instrument for me',
      handler: async () => {
        // TODO: call AI agent
        await new Promise(resolve => setTimeout(resolve, 200));
        addSuccessMessage(
          "Seer is on it. We'll add this back to your stack when a PR is ready for review."
        );
      },
      loadingLabel: 'Starting...',
    });

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction]);

  return (
    <CardContainer>
      <Content>
        <HeaderSection>
          <Text size="xl" bold>
            {t('Observability Gap Detected')}
          </Text>
          <Text size="md">{description}</Text>
        </HeaderSection>

        <ProductsSection>
          <Text size="lg" bold variant="muted">
            {t('Recommended Tools')}
          </Text>

          <ProductGrid>
            {products.map(product => (
              <ProductCard
                key={product}
                onClick={() =>
                  window.open(PRODUCT_DOCS[product], '_blank', 'noopener,noreferrer')
                }
              >
                <ProductIcon>
                  <img
                    src={PRODUCT_ILLUSTRATIONS[product]}
                    alt={PRODUCT_NAMES[product]}
                  />
                </ProductIcon>
                <ProductInfo>
                  <Text size="sm" bold>
                    {PRODUCT_NAMES[product]}
                  </Text>
                  <ProductDescription size="xs" variant="muted">
                    {getProductDescription(product)}
                  </ProductDescription>
                </ProductInfo>
              </ProductCard>
            ))}
          </ProductGrid>
        </ProductsSection>
      </Content>
    </CardContainer>
  );
}

function getProductDescription(product: InstrumentationProduct): string {
  switch (product) {
    case InstrumentationProduct.TRACING:
      return t('Track requests across your application');
    case InstrumentationProduct.PROFILING:
      return t('Identify performance bottlenecks in your code');
    case InstrumentationProduct.UPTIME:
      return t('Monitor your application availability');
    case InstrumentationProduct.PERFORMANCE:
      return t('Monitor application performance metrics');
    case InstrumentationProduct.ERRORS:
      return t('Track and debug application errors');
    case InstrumentationProduct.REPLAY:
      return t('See what users did before encountering issues');
    case InstrumentationProduct.CRONS:
      return t('Monitor scheduled jobs and tasks');
    default:
      return t('Improve your application monitoring');
  }
}

const CardContainer = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${space(3)};
  gap: ${space(3)};
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ProductsSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  flex: 1;
`;

const ProductGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(3)};
  width: 100%;
`;

const ProductCard = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 1;
  height: 200px;
  width: 100%;

  &:hover {
    border-color: ${p => p.theme.purple300};
  }
`;

const ProductIcon = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.backgroundSecondary};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const ProductInfo = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundElevated};
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

const ProductDescription = styled(Text)``;

export default MissingInstrumentationCardRenderer;
export type {MissingInstrumentationCard, MissingInstrumentationCardData};
