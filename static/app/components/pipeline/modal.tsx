import {Fragment, useEffect, useEffectEvent} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProgressRing} from 'sentry/components/progressRing';
import {IconRefresh} from 'sentry/icons';
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
  /** Overrides the step's default descriptive copy. */
  description?: string;
  initialData?: Record<string, string>;
  onComplete?: (data: CompletionDataFor<T, P>) => void;
  onError?: (error: string) => void;
  /** Overrides the header title (defaults to the pipeline's `actionTitle`). */
  title?: string;
}

function PipelineModal<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
>({
  Header,
  Body,
  closeModal,
  type,
  provider,
  initialData,
  onComplete,
  onError,
  title,
  description,
}: PipelineModalProps<T, P>) {
  const handleComplete = (data: CompletionDataFor<T, P>) => {
    onComplete?.(data);
    closeModal();
  };

  const pipeline = usePipeline(type, provider, {
    onComplete: handleComplete,
    initialData,
    description,
  });
  const {stepDefinition} = pipeline;
  // Keeps `onError` out of the deps below. Every distinct error is reported, so a
  // retry that fails again reports again.
  const reportError = useEffectEvent((error: string) => {
    onError?.(error);
  });

  useEffect(() => {
    if (pipeline.error) {
      reportError(pipeline.error);
    }
  }, [pipeline.error]);

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
        <Text size="lg">{title ?? pipeline.definition.actionTitle}</Text>
      </Header>
      <Body>
        <Stack gap="2xl">
          {!pipeline.isComplete && pipeline.totalSteps > 1 && (
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
                      transition={{duration: 0.2}}
                      style={{gridColumn: 1, gridRow: 1}}
                    >
                      {stepText}
                    </motion.div>
                  </AnimatePresence>
                </Grid>
              </Flex>
              <Flex gap="md" align="center">
                {loading && (
                  <LoadingIndicator
                    mini
                    size={20}
                    style={{margin: 0, height: 20, width: 20}}
                  />
                )}
                {pipeline.stepIndex !== 0 && (
                  <Button
                    size="zero"
                    variant="transparent"
                    onClick={pipeline.restart}
                    icon={<IconRefresh size="xs" variant="muted" />}
                    tooltipProps={{title: t('Restart flow')}}
                    aria-label={t('Restart flow')}
                  />
                )}
              </Flex>
            </Grid>
          )}

          {pipeline.error && (
            <Alert
              variant="danger"
              trailingItems={
                <Alert.Button onClick={pipeline.restart}>{t('Start over')}</Alert.Button>
              }
            >
              {pipeline.error}
            </Alert>
          )}
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
  description?: string;
  initialData?: Record<string, string>;
  onClose?: () => void;
  onComplete?: (data: CompletionDataFor<T, P>) => void;
  onError?: (error: string) => void;
  title?: string;
}

export function openPipelineModal<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T] = ProvidersByType[T],
>({
  type,
  provider,
  initialData,
  onComplete,
  onClose,
  onError,
  title,
  description,
}: OpenPipelineModalOptions<T, P>) {
  openModal(
    deps => (
      <PipelineModal
        {...deps}
        type={type}
        provider={provider}
        initialData={initialData}
        onComplete={onComplete}
        onError={onError}
        title={title}
        description={description}
      />
    ),
    {onClose, closeEvents: 'none'}
  );
}
