import {useId} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  ActionRequestApply,
  ActionRequestDetails,
  getAppliedSummary,
  getApplyErrorMessage,
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

const SHOWN_STATES = new Set<InvestigationActionRequest['state']>([
  'suggested',
  'applied',
  'withdrawn',
]);

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
        if (applyError?.code === 'validation_failed') {
          return;
        }
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

  const applying =
    applyMutation.isPending && applyMutation.variables?.id === actionRequest.id;
  const applyError =
    applyMutation.variables?.id === actionRequest.id
      ? parseApplyError(applyMutation.error)
      : null;
  const appliedSummary =
    actionRequest.state === 'applied' ? getAppliedSummary(actionRequest, source) : null;

  return (
    <Stack as="section" gap="lg" {...labelProps}>
      {headingElement}
      <Stack gap="xs">
        <Text as="p" size="md" density="comfortable">
          {appliedSummary ??
            tct('[title] [rationale]', {
              title: <Text bold>{ensureSentenceEnd(actionRequest.title)}</Text>,
              rationale: actionRequest.rationale,
            })}
        </Text>
        {actionRequest.state === 'applied' ? (
          <AppliedBy actionRequest={actionRequest} />
        ) : null}
      </Stack>
      <ActionRequestDetails actionRequest={actionRequest} source={source} />
      {applyError?.code === 'validation_failed' ? (
        <Alert.Container>
          <Alert variant="danger" role="alert">
            {t(
              'This change could not be applied. %s',
              getApplyErrorMessage(actionRequest.action, applyError)
            )}
          </Alert>
        </Alert.Container>
      ) : null}
      <ActionRequestApply
        actionRequest={actionRequest}
        applying={applying}
        check={check}
        onApply={() => applyMutation.mutate(actionRequest)}
      />
    </Stack>
  );
}

function AppliedBy({actionRequest}: {actionRequest: InvestigationActionRequest}) {
  const user = useUser();
  const {appliedBy, dateApplied} = actionRequest;
  const time = dateApplied ? <TimeSince date={dateApplied} /> : null;
  if (!appliedBy) {
    return (
      <Text as="p" size="sm" variant="muted">
        {time ? tct('Applied [time]', {time}) : t('Applied')}
      </Text>
    );
  }
  const name = appliedBy.id === user.id ? t('you') : appliedBy.name || appliedBy.email;
  return (
    <Text as="p" size="sm" variant="muted">
      {time
        ? tct('Applied by [name] • [time]', {name, time})
        : tct('Applied by [name]', {name})}
    </Text>
  );
}

function isShownActionRequest(actionRequest: InvestigationActionRequest) {
  return SHOWN_STATES.has(actionRequest.state);
}
