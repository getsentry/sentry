import {Fragment, useCallback, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Event} from '@sentry/core';
import {
  BrowserClient,
  captureFeedback,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
} from '@sentry/react';
import cloneDeep from 'lodash/cloneDeep';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import Textarea from 'sentry/components/forms/controls/textarea';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import type {Data} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

export const feedbackClient = new BrowserClient({
  // feedback project under Sentry organization
  dsn: 'https://3c5ef4e344a04a0694d187a1272e96de@o1.ingest.sentry.io/6356259',
  transport: makeFetchTransport,
  stackParser: defaultStackParser,
  integrations: getDefaultIntegrations({}),
});

const defaultFeedbackTypes = [
  t("I don't like this feature"),
  t('I like this feature'),
  t('Other reason'),
];

export type ChildrenProps<T> = {
  Body: (props: {
    children: React.ReactNode;
    showSelfHostedMessage?: boolean;
  }) => ReturnType<ModalRenderProps['Body']>;
  Footer: (props: {
    onBack?: () => void;
    onNext?: () => void;
    primaryDisabledReason?: string;
    secondaryAction?: React.ReactNode;
    submitEventData?: Event;
  }) => ReturnType<ModalRenderProps['Footer']>;
  Header: (props: {children: React.ReactNode}) => ReturnType<ModalRenderProps['Header']>;
  onFieldChange: <Field extends keyof T>(field: Field, value: T[Field]) => void;
  state: T;
};

type CustomFeedbackModal<T> = {
  children: (props: ChildrenProps<T>) => React.ReactNode;
  featureName: string;
  initialData: T;
};

type DefaultFeedbackModal = {
  featureName: string;
  children?: undefined;
  feedbackTypes?: string[];
  secondaryAction?: React.ReactNode;
};

export type FeedbackModalProps<T extends Data> = (
  | DefaultFeedbackModal
  | CustomFeedbackModal<T>
) & {
  /** Use the actual user feedback feature instead of simply creating a message event. */
  useNewUserFeedback?: boolean;
};

export function FeedbackModal<T extends Data>({
  Header,
  Body,
  Footer,
  closeModal,
  ...props
}: FeedbackModalProps<T> & ModalRenderProps) {
  const {organization} = useLegacyStore(OrganizationStore);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const location = useLocation();

  const theme = useTheme();
  const user = useUser();
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const [state, setState] = useState<T>(
    props.children === undefined
      ? ({subject: undefined, additionalInfo: undefined} as unknown as T)
      : props.initialData
  );
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);

  const project = useMemo(() => {
    if (projectsLoaded && location.query.project) {
      return projects.find(p => p.id === location.query.project);
    }
    return undefined;
  }, [projectsLoaded, projects, location.query.project]);

  const handleSubmit = useCallback(
    (submitEventData?: Event) => {
      const message = `${props.featureName} feedback by ${user.email}`;

      const commonEventProps: Event = {
        message,
        request: {
          url: window.location.href, // gives the full url (origin + pathname)
        },
        extra: {
          orgFeatures: organization?.features ?? [],
          orgAccess: organization?.access ?? [],
          projectFeatures: project?.features ?? [],
        },
        tags: {
          featureName: props.featureName,
        },
        user,
        level: 'info',
      };

      if (props.children === undefined) {
        const feedbackTypes = props.feedbackTypes ?? defaultFeedbackTypes;
        const fullMessage = state.additionalInfo?.trim()
          ? `${message} - ${feedbackTypes[state.subject]} - ${state.additionalInfo}`
          : `${message} - ${feedbackTypes[state.subject]}`;
        if (props.useNewUserFeedback) {
          captureFeedback({
            message: fullMessage,
            source: props.featureName,
            tags: {
              feature: props.featureName,
            },
          });
        } else {
          feedbackClient.captureEvent({
            ...commonEventProps,
            contexts: {
              feedback: {
                additionalInfo: state.additionalInfo?.trim()
                  ? state.additionalInfo
                  : null,
              },
            },
            message: fullMessage,
          });
        }
      } else {
        if (props.useNewUserFeedback) {
          captureFeedback({
            message,
            source: props.featureName,
            tags: {
              feature: props.featureName,
            },
          });
        } else {
          feedbackClient.captureEvent({
            ...commonEventProps,
            ...(submitEventData ?? {}),
          });
        }
      }

      addSuccessMessage(t('Thanks for taking the time to provide us feedback!'));
      closeModal();
    },
    [
      closeModal,
      organization?.features,
      organization?.access,
      project?.features,
      user,
      props,
      state,
    ]
  );

  const ModalHeader = useCallback(
    ({children: headerChildren}: {children: React.ReactNode}) => {
      return (
        <Header closeButton>
          <h3>{headerChildren}</h3>
        </Header>
      );
    },
    [Header]
  );

  const ModalFooter = useCallback(
    ({
      onBack,
      onNext,
      submitEventData,
      primaryDisabledReason,
      secondaryAction,
    }: Parameters<ChildrenProps<T>['Footer']>[0]) => {
      return (
        <Footer>
          {secondaryAction && (
            <SecondaryActionWrapper>{secondaryAction}</SecondaryActionWrapper>
          )}
          {onBack && (
            <BackButtonWrapper>
              <Button onClick={onBack}>{t('Back')}</Button>
            </BackButtonWrapper>
          )}
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              title={
                props.children === undefined
                  ? !defined(state.subject)
                    ? t('Required fields must be filled out')
                    : undefined
                  : primaryDisabledReason
              }
              onClick={onNext ?? (() => handleSubmit(submitEventData))}
              disabled={
                props.children === undefined
                  ? !defined(state.subject)
                  : defined(primaryDisabledReason)
              }
            >
              {onNext ? t('Next') : isScreenSmall ? t('Submit') : t('Submit Feedback')}
            </Button>
          </ButtonBar>
        </Footer>
      );
    },
    [Footer, isScreenSmall, closeModal, handleSubmit, state, props.children]
  );

  const ModalBody = useCallback(
    ({
      children: bodyChildren,
      showSelfHostedMessage = true,
    }: Parameters<ChildrenProps<T>['Body']>[0]) => {
      return (
        <Body>
          {bodyChildren}
          {isSelfHosted && showSelfHostedMessage && (
            <Alert.Container>
              <Alert type="info">
                {tct(
                  "You agree that any feedback you submit is subject to Sentry's [privacyPolicy:Privacy Policy] and Sentry may use such feedback without restriction or obligation.",
                  {
                    privacyPolicy: <ExternalLink href="https://sentry.io/privacy/" />,
                  }
                )}
              </Alert>
            </Alert.Container>
          )}
        </Body>
      );
    },
    [Body, isSelfHosted]
  );

  function handleFieldChange<Field extends keyof T>(field: Field, value: T[Field]) {
    const newState = cloneDeep(state);
    newState[field] = value;
    setState(newState);
  }

  if (props.children === undefined) {
    const feedbackTypes = props.feedbackTypes ?? defaultFeedbackTypes;

    return (
      <Fragment>
        <ModalHeader>{t('Submit Feedback')}</ModalHeader>
        <ModalBody>
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
            onChange={(value: any) => setState({...state, subject: value})}
            flexibleControlStateSize
            stacked
            required
          />
          <FieldGroup
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
          </FieldGroup>
        </ModalBody>
        <ModalFooter secondaryAction={props?.secondaryAction} />
      </Fragment>
    );
  }

  return (
    <Fragment>
      {props.children({
        Header: ModalHeader,
        Body: ModalBody,
        Footer: ModalFooter,
        onFieldChange: handleFieldChange,
        state,
      })}
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;

const BackButtonWrapper = styled('div')`
  margin-right: ${space(1)};
  width: 100%;
`;

const SecondaryActionWrapper = styled('div')`
  flex: 1;
  align-self: center;
`;
