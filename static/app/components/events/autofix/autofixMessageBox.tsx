import {type FormEvent, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {type AutofixStep, AutofixStepType} from 'sentry/components/events/autofix/types';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  IconCheckmark,
  IconChevron,
  IconClose,
  IconCode,
  IconFatal,
  IconQuestion,
  IconSad,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

function useSendMessage({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: (params: {message: string}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'user_message',
            text: params.message,
          },
        },
      });
    },
    onSuccess: _ => {
      addSuccessMessage("Thanks for the input! I'll get to it right after this.");
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Autofix your message.'));
    },
  });
}

interface AutofixMessageBoxProps {
  actionText: string;
  allowEmptyMessage: boolean;
  displayText: string;
  groupId: string;
  inputPlaceholder: string;
  isDisabled: boolean;
  onSend: ((message: string) => void) | null;
  responseRequired: boolean;
  runId: string;
  step: AutofixStep | null;
  emptyInfoText?: string;
  notEmptyInfoText?: string;
  primaryAction?: boolean;
  scrollIntoView?: (() => void) | null;
}

function StepIcon({step}: {step: AutofixStep}) {
  if (step.type === AutofixStepType.CHANGES) {
    return <IconCode size="sm" color="gray300" />;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    if (step.causes?.length === 0) {
      return <IconSad size="sm" color="gray300" />;
    }
    return step.selection ? (
      <IconCheckmark size="sm" color="green300" isCircled />
    ) : (
      <IconQuestion size="sm" color="gray300" />
    );
  }

  switch (step.status) {
    case 'PROCESSING':
      return <ProcessingStatusIndicator size={14} mini hideMessage />;
    case 'CANCELLED':
      return <IconClose size="sm" isCircled color="gray300" />;
    case 'ERROR':
      return <IconFatal size="sm" color="red300" />;
    case 'COMPLETED':
      return <IconCheckmark size="sm" color="green300" isCircled />;
    default:
      return null;
  }
}

function AutofixMessageBox({
  displayText = '',
  step = null,
  inputPlaceholder = 'Say something...',
  primaryAction = false,
  responseRequired = false,
  onSend,
  actionText = 'Send',
  allowEmptyMessage = false,
  isDisabled = false,
  groupId,
  runId,
  emptyInfoText = '',
  notEmptyInfoText = '',
  scrollIntoView = null,
}: AutofixMessageBoxProps) {
  const [message, setMessage] = useState('');
  const {mutate: send} = useSendMessage({groupId, runId});

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (message.trim() !== '' || allowEmptyMessage) {
      if (onSend != null) {
        onSend(message);
      } else {
        send({
          message: message,
        });
      }
      setMessage('');
    }
  };

  return (
    <Container>
      <DisplayArea>
        {step && (
          <StepHeader>
            <StepIconContainer>
              <StepIcon step={step} />
            </StepIconContainer>
            <StepTitle
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(step.title),
              }}
            />
            {scrollIntoView !== null && (
              <Button
                onClick={scrollIntoView}
                priority="link"
                icon={<IconChevron isCircled direction="down" />}
                aria-label={t('Jump to content')}
              />
            )}
          </StepHeader>
        )}
        <Message
          dangerouslySetInnerHTML={{
            __html: marked(displayText),
          }}
        />
        <ActionBar>
          <p>{message.length > 0 ? notEmptyInfoText : emptyInfoText}</p>
        </ActionBar>
      </DisplayArea>
      <form onSubmit={handleSend}>
        <InputArea>
          {!responseRequired ? (
            <Fragment>
              <NormalInput
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={inputPlaceholder}
                disabled={isDisabled}
              />
              <Button
                type="submit"
                priority={primaryAction ? 'primary' : 'default'}
                disabled={isDisabled}
              >
                {actionText}
              </Button>
            </Fragment>
          ) : (
            <Fragment>
              <RequiredInput
                type="text"
                value={message}
                disabled={isDisabled}
                onChange={e => setMessage(e.target.value)}
                placeholder={'Please answer to continue...'}
              />
              <Button type="submit" priority={'primary'} disabled={isDisabled}>
                {actionText}
              </Button>
            </Fragment>
          )}
        </InputArea>
      </form>
    </Container>
  );
}

const Container = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  z-index: 100;
  border-top: 1px solid ${p => p.theme.border};
  padding: 16px;
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const DisplayArea = styled('div')`
  height: 8em;
  overflow-y: hidden;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 2px;
`;

const Message = styled('div')`
  overflow-y: scroll;
  height: 7em;
`;

const StepTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  white-space: nowrap;
  display: flex;
  flex-shrink: 1;
  align-items: center;
  flex-grow: 0;

  span {
    margin-right: ${space(1)};
  }
`;
const StepIconContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
`;

const StepHeader = styled('div')`
  display: flex;
  align-items: center;
  padding-bottom: ${space(1)};
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};

  &:last-child {
    padding-bottom: ${space(2)};
  }
`;

const InputArea = styled('div')`
  display: flex;
`;

const NormalInput = styled(Input)`
  flex-grow: 1;
  margin-right: 8px;
`;

const RequiredInput = styled(Input)`
  flex-grow: 1;
  margin-right: 8px;
  border-color: ${p => p.theme.errorFocus};
  box-shadow: 0 0 0 1px ${p => p.theme.errorFocus};
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const ActionBar = styled('div')`
  position: absolute;
  bottom: 3em;
  color: ${p => p.theme.subText};
`;

export default AutofixMessageBox;
