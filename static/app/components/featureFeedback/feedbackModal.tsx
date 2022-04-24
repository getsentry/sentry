import {Fragment, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import {BrowserClient} from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Textarea from 'sentry/components/forms/controls/textarea';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

import ButtonBar from '../buttonBar';
import Field from '../forms/field';

const feedbackClient = new BrowserClient({
  // feedback project under Sentry organization
  dsn: 'https://3c5ef4e344a04a0694d187a1272e96de@o1.ingest.sentry.io/6356259',
});

export interface FeedBackModalProps {
  feedbackTypes: string[];
}

interface Props
  extends FeedBackModalProps,
    Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer' | 'closeModal'> {}

type State = {additionalInfo?: string; subject?: number};

export function FeedbackModal({Header, Body, Footer, closeModal, feedbackTypes}: Props) {
  const {organization} = useLegacyStore(OrganizationStore);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const location = useLocation();
  const {user} = useLegacyStore(ConfigStore);

  const [state, setState] = useState<State>({
    subject: undefined,
    additionalInfo: undefined,
  });

  const project = useMemo(() => {
    if (projectsLoaded && location.query.project) {
      return projects.find(p => p.id === location.query.project);
    }
    return undefined;
  }, [projectsLoaded, location.query.project]);

  function handleSubmit() {
    const {subject, additionalInfo} = state;

    if (!defined(subject)) {
      return;
    }

    feedbackClient.captureEvent({
      user,
      tags: {
        url: location.pathname,
      },
      extra: {
        url: location.pathname,
        orgFeatures: organization?.features ?? [],
        orgAccess: organization?.access ?? [],
        projectFeatures: project?.features ?? [],
      },
      message: additionalInfo?.trim()
        ? `${feedbackTypes[subject]} - ${additionalInfo}`
        : feedbackTypes[subject],
    });

    addSuccessMessage('Thanks for taking the time to provide us feedback!');

    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Submit Feedback')}</h3>
      </Header>
      <Body>
        <SelectField
          label={t('Type of feedback')}
          name="subject"
          inline={false}
          options={feedbackTypes.map((feedbackType, index) => ({
            value: index,
            label: feedbackType,
          }))}
          placeholder={t('Select type of feedback')}
          value={state.subject}
          onChange={value => setState({...state, subject: value})}
          flexibleControlStateSize
          stacked
          required
        />
        <Field
          label={t('Additional feedback')}
          inline={false}
          required={false}
          flexibleControlStateSize
          stacked
        >
          <Textarea
            name="additional-feedback"
            value={state.additionalInfo}
            rows={5}
            autosize
            placeholder={t('What did you expect?')}
            onChange={event =>
              setState({
                ...state,
                additionalInfo: event.target.value,
              })
            }
          />
        </Field>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={handleSubmit}
            disabled={!defined(state.subject)}
          >
            {t('Submit Feedback')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
