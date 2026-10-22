import {useId} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';
import {ActionRequestDetails} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import {ensureSentenceEnd} from 'sentry/views/investigations/sentence';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionRequestCardProps = {
  actionRequest: InvestigationActionRequest;
  heading?: string;
  source?: InvestigationDetail['source'];
};

export function ActionRequestCard({
  actionRequest,
  heading,
  source,
}: ActionRequestCardProps) {
  const headingId = useId();

  if (actionRequest.state !== 'suggested' && actionRequest.state !== 'withdrawn') {
    return null;
  }

  const labelProps = heading
    ? {'aria-labelledby': headingId}
    : {'aria-label': actionRequest.title};
  const headingElement = heading ? (
    <Heading as="h2" size="lg" id={headingId}>
      {heading}
    </Heading>
  ) : null;

  if (actionRequest.state === 'withdrawn') {
    return (
      <Stack as="section" gap="md" {...labelProps}>
        {headingElement}
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
    <Stack as="section" gap="lg" {...labelProps}>
      {headingElement}
      <Text as="p" size="md" density="comfortable">
        {tct('[title] [rationale]', {
          title: <Text bold>{ensureSentenceEnd(actionRequest.title)}</Text>,
          rationale: actionRequest.rationale,
        })}
      </Text>
      <ActionRequestDetails actionRequest={actionRequest} source={source} />
    </Stack>
  );
}
