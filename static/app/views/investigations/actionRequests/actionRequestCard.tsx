import {useId} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ActionRequestApply,
  ActionRequestDetails,
  getApplySuccessMessage,
  getCannotApplyMessage,
  useApplyCheck,
} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import {
  parseApplyError,
  useApplyInvestigationActionRequestMutation,
} from 'sentry/views/investigations/api';
import {ensureSentenceEnd} from 'sentry/views/investigations/sentence';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionRequestCardProps = {
  actionRequest: InvestigationActionRequest;
  investigationId: string;
  heading?: string;
  source?: InvestigationDetail['source'];
};

export function ActionRequestCard({
  actionRequest,
  heading,
  investigationId,
  source,
}: ActionRequestCardProps) {
  const headingId = useId();
  const organization = useOrganization();
  const check = useApplyCheck(investigationId, actionRequest);
  const applyMutation = useApplyInvestigationActionRequestMutation(
    organization.slug,
    investigationId,
    {
      onSuccess: (_response, applied) => {
        const message = getApplySuccessMessage(applied.action);
        if (message) {
          toast.success(message);
        }
      },
      onError: (error, applied) => {
        const applyError = parseApplyError(error);
        toast.error(
          applyError
            ? getCannotApplyMessage(applied.action, applyError.code)
            : t('Unable to apply this change.')
        );
      },
    }
  );

  if (!isShownActionRequest(actionRequest)) {
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
      <ActionRequestApply
        actionRequest={actionRequest}
        applying={
          applyMutation.isPending && applyMutation.variables?.id === actionRequest.id
        }
        check={check}
        onApply={() => applyMutation.mutate(actionRequest)}
      />
    </Stack>
  );
}

export function isShownActionRequest(actionRequest: InvestigationActionRequest) {
  return actionRequest.state === 'suggested' || actionRequest.state === 'withdrawn';
}
