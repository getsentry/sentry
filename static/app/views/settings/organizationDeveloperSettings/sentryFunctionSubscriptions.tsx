import styled from '@emotion/styled';

import FormModel from 'sentry/components/forms/model';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';

import {EVENT_CHOICES} from './constants';
import SubscriptionBox from './subscriptionBox';

type Resource = typeof EVENT_CHOICES[number];

type Props = {
  form: React.MutableRefObject<FormModel>;
  onComment: boolean;
  onError: boolean;
  onIssue: boolean;
  setOnComment: (value: boolean) => void;
  setOnError: (value: boolean) => void;
  setOnIssue: (value: boolean) => void;
};

function SentryFunctionSubscriptions(props: Props) {
  const {form, onComment, onError, onIssue, setOnComment, setOnError, setOnIssue} = props;
  function onChange(resource: Resource, checked: boolean) {
    // TODO: talk to Steve about why the nots are needed
    // right now, I'm assuming that checked is only true if the value of the box is *changed*,
    // not actually when the box is checked.
    if (resource === 'issue') {
      setOnIssue(checked);
      form.current.setValue('onIssue', !onIssue);
    } else if (resource === 'error') {
      setOnError(checked);
      form.current.setValue('onError', !onError);
    } else if (resource === 'comment') {
      setOnComment(checked);
      form.current.setValue('onComment', !onComment);
    }
  }
  return (
    <Panel>
      <PanelHeader>{t('Webhooks')}</PanelHeader>
      <PanelBody>
        <SentryFunctionsSubscriptionGrid>
          <SubscriptionBox
            key="issue"
            disabledFromPermissions={false}
            webhookDisabled={false}
            checked={onIssue}
            resource="issue"
            onChange={onChange}
            isNew={false}
          />
          <SubscriptionBox
            key="error"
            disabledFromPermissions={false}
            webhookDisabled={false}
            checked={onError}
            resource="error"
            onChange={onChange}
            isNew={false}
          />
          <SubscriptionBox
            key="comment"
            disabledFromPermissions={false}
            webhookDisabled={false}
            checked={onComment}
            resource="comment"
            onChange={onChange}
            isNew
          />
        </SentryFunctionsSubscriptionGrid>
      </PanelBody>
    </Panel>
  );
}

export default SentryFunctionSubscriptions;
const SentryFunctionsSubscriptionGrid = styled('div')`
  display: grid;
  grid-template: auto / 1fr 1fr 1fr;
  @media (max-width: ${props => props.theme.breakpoints.large}) {
    grid-template: 1fr 1fr 1fr / auto;
  }
`;
