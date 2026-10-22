import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionRequestCardProps = {
  investigation: InvestigationDetail;
  select: (actionRequest: InvestigationActionRequest) => boolean;
  heading?: string;
};

export function ActionRequestCard({
  heading,
  investigation,
  select,
}: ActionRequestCardProps) {
  const actionRequest = (investigation.actionRequests ?? []).find(select) ?? null;

  if (!actionRequest) {
    return null;
  }

  const ariaLabel = heading ?? actionRequest.title;

  if (actionRequest.state === 'withdrawn') {
    return (
      <Stack as="section" gap="md" aria-label={ariaLabel}>
        {heading ? (
          <Heading as="h2" size="lg">
            {heading}
          </Heading>
        ) : null}
        <Text as="p" size="md" density="comfortable" variant="muted">
          {actionRequest.reason
            ? tct('Seer no longer recommends “[title]”: [reason]', {
                title: actionRequest.title,
                reason: actionRequest.reason,
              })
            : tct('Seer no longer recommends “[title]”.', {title: actionRequest.title})}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack as="section" gap="lg" aria-label={ariaLabel}>
      {heading ? (
        <Heading as="h2" size="lg">
          {heading}
        </Heading>
      ) : null}
      <Text as="p" size="md" density="comfortable">
        <Text bold>{withPeriod(actionRequest.title)}</Text> {actionRequest.rationale}
      </Text>
      {actionRequest.impact ? (
        <Text as="p" size="md" density="comfortable">
          {actionRequest.impact}
        </Text>
      ) : null}
    </Stack>
  );
}

function withPeriod(sentence: string) {
  const trimmed = sentence.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
