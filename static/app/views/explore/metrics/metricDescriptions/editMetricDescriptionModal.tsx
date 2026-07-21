import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceMetricListItem} from 'sentry/views/explore/metrics/metricDescriptions/types';

const BRIEF_MAX_LENGTH = 280;

interface EditMetricDescriptionModalProps extends ModalRenderProps {
  metric: TraceMetricListItem;
  onSuccess: () => void;
}

interface UpdateVariables {
  additionalContext: string;
  brief: string;
}

export function EditMetricDescriptionModal({
  Header,
  Body,
  Footer,
  closeModal,
  metric,
  onSuccess,
}: EditMetricDescriptionModalProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [brief, setBrief] = useState(metric.context?.brief ?? '');
  const [additionalContext, setAdditionalContext] = useState(
    metric.context?.additionalContext ?? ''
  );

  const {mutate, isPending} = useMutation({
    mutationFn: (variables: UpdateVariables) => {
      // Scope the request to the currently selected projects / environments /
      // time range, so the endpoint's existence check matches what was listed.
      const query: Record<string, string | string[] | number[] | undefined> = {
        project: selection.projects.length ? selection.projects.map(String) : ['-1'],
        environment: selection.environments.length ? selection.environments : undefined,
      };
      Object.entries(normalizeDateTimeParams(selection.datetime)).forEach(
        ([key, value]) => {
          if (defined(value)) {
            query[key] = value;
          }
        }
      );

      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/trace-items/metrics/${encodeURIComponent(
          metric.name
        )}/context/`,
        options: {query},
        data: {
          metricType: metric.type,
          brief: variables.brief,
          additionalContext: variables.additionalContext || null,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Saved description for %s', metric.name));
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage(t('Failed to save description for %s', metric.name));
    },
  });

  const canSubmit = brief.trim().length > 0 && brief.length <= BRIEF_MAX_LENGTH;

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (canSubmit && !isPending) {
          mutate({brief, additionalContext});
        }
      }}
    >
      <Header closeButton>
        <Heading as="h4">{t('Edit metric description')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Stack gap="xs">
            <Text size="sm" variant="muted">
              {tct('[name] · [type][unit]', {
                name: <Text bold>{metric.name}</Text>,
                type: metric.type,
                unit: metric.unit ? ` · ${metric.unit}` : '',
              })}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text as="label" size="sm" bold>
              {t('Brief')}
            </Text>
            <InputGroup>
              <InputGroup.Input
                autoFocus
                maxLength={BRIEF_MAX_LENGTH}
                value={brief}
                placeholder={t('A concise, human-readable summary of this metric')}
                onChange={e => setBrief(e.target.value)}
              />
            </InputGroup>
            <Text size="xs" variant="muted">
              {t('%s/%s characters', brief.length, BRIEF_MAX_LENGTH)}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text as="label" size="sm" bold>
              {t('Additional context (optional)')}
            </Text>
            <InputGroup>
              <InputGroup.TextArea
                rows={4}
                value={additionalContext}
                placeholder={t('Any extra notes, caveats, or usage guidance')}
                onChange={e => setAdditionalContext(e.target.value)}
              />
            </InputGroup>
          </Stack>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal} disabled={isPending}>
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
            {isPending ? t('Saving…') : t('Save')}
          </Button>
        </Flex>
      </Footer>
    </form>
  );
}
