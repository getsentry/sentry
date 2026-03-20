import {Fragment} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProgressRing} from 'sentry/components/progressRing';
import {t} from 'sentry/locale';

import type {
  CompletionDataFor,
  ProvidersByType,
  RegisteredPipelineType,
} from './registry';
import {usePipeline} from './usePipeline';

interface PipelineModalProps<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
> extends ModalRenderProps {
  provider: P;
  type: T;
  onComplete?: (data: CompletionDataFor<T, P>) => void;
}

function PipelineModal<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
>({Header, Body, closeModal, type, provider, onComplete}: PipelineModalProps<T, P>) {
  const handleComplete = (data: CompletionDataFor<T, P>) => {
    onComplete?.(data);
    closeModal();
  };

  const pipeline = usePipeline(type, provider, {onComplete: handleComplete});
  const {stepDefinition} = pipeline;

  const stepText = (
    <Text variant="muted">
      {t(
        'Step %s of %s: %s',
        pipeline.stepIndex + 1,
        pipeline.totalSteps,
        stepDefinition?.shortDescription
      )}
    </Text>
  );

  const loading = pipeline.isInitializing || pipeline.isAdvancing;

  return (
    <Fragment>
      <Header closeButton>
        <Text size="lg">{pipeline.definition.actionTitle}</Text>
      </Header>
      <Body>
        <Stack gap="2xl">
          <Grid columns="1fr max-content">
            <Flex gap="md" align="center">
              <ProgressRing
                maxValue={pipeline.totalSteps}
                value={pipeline.stepIndex + 1}
                text={pipeline.stepIndex + 1}
                animate
              />
              <Grid>
                <AnimatePresence>
                  <motion.div
                    key={stepDefinition?.stepId}
                    initial={pipeline.stepIndex === 0 ? {} : {y: -15, opacity: 0}}
                    animate={{y: 0, opacity: 1}}
                    exit={{y: 15, opacity: 0}}
                    transition={{duration: 0.3}}
                    style={{gridColumn: 1, gridRow: 1}}
                  >
                    {stepText}
                  </motion.div>
                </AnimatePresence>
              </Grid>
            </Flex>
            {loading && (
              <LoadingIndicator
                mini
                size={20}
                style={{margin: 0, height: 20, width: 20}}
              />
            )}
          </Grid>

          {pipeline.error && <Text variant="muted">Error: {pipeline.error.message}</Text>}
          {pipeline.view}
        </Stack>
      </Body>
    </Fragment>
  );
}

interface OpenPipelineModalOptions<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
> {
  provider: P;
  type: T;
  onClose?: () => void;
  onComplete?: (data: CompletionDataFor<T, P>) => void;
}

export function openPipelineModal<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
>({type, provider, onComplete, onClose}: OpenPipelineModalOptions<T, P>) {
  openModal(
    deps => (
      <PipelineModal {...deps} type={type} provider={provider} onComplete={onComplete} />
    ),
    {onClose, closeEvents: 'none'}
  );
}
