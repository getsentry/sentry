import {createContext, Fragment, useCallback, useContext, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import type {Event} from '@sentry/core';
import {
  BrowserClient,
  captureFeedback,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
} from '@sentry/react';
import cloneDeep from 'lodash/cloneDeep';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Grid, Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TextArea} from '@sentry/scraps/textarea';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import type {Data} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

const feedbackClient = new BrowserClient({
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

type ChildrenProps<T> = {
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

type FeedbackModalContextValue = {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  closeModal: () => void;
  handleSubmit: (submitEventData?: Event) => void;
  isCustomChildren: boolean;
  isScreenSmall: boolean;
  isSelfHosted: boolean;
  state: Data;
};

const FeedbackModalContext = createContext<FeedbackModalContextValue | null>(null);

function useFeedbackModalContext(): FeedbackModalContextValue {
  const ctx = useContext(FeedbackModalContext);
  if (!ctx) {
    throw new Error('useFeedbackModalContext must be used within FeedbackModal');
  }
  return ctx;
}

function FeedbackModalHeader({children: headerChildren}: {children: React.ReactNode}) {
  const {Header} = useFeedbackModalContext();
  return (
    <Header closeButton>
      <h3>{headerChildren}</h3>
    </Header>
  );
}

type FooterProps = {
  onBack?: () => void;
  onNext?: () => void;
  primaryDisabledReason?: string;
  secondaryAction?: React.ReactNode;
  submitEventData?: Event;
};

function FeedbackModalFooter({
  onBack,
  onNext,
  submitEventData,
  primaryDisabledReason,
  secondaryAction,
}: FooterProps) {
  const {Footer, closeModal, handleSubmit, isScreenSmall, isCustomChildren, state} =
    useFeedbackModalContext();
  return (
    <Footer>
      {secondaryAction && (
        <Container flex="1" alignSelf="center">
          {secondaryAction}
        </Container>
      )}
      {onBack && (
        <Container marginRight="md" width="100%">
          <Button onClick={onBack}>{t('Back')}</Button>
        </Container>
      )}
      <Grid flow="column" align="center" gap="md">
        <Button onClick={closeModal}>{t('Cancel')}</Button>
        <Button
          variant="primary"
          tooltipProps={{
            title: isCustomChildren
              ? primaryDisabledReason
              : defined(state.subject)
                ? undefined
                : t('Required fields must be filled out'),
          }}
          onClick={onNext ?? (() => handleSubmit(submitEventData))}
          disabled={
            isCustomChildren ? defined(primaryDisabledReason) : !defined(state.subject)
          }
        >
          {onNext ? t('Next') : isScreenSmall ? t('Submit') : t('Submit Feedback')}
        </Button>
      </Grid>
    </Footer>
  );
}

type BodyProps = {
  children: React.ReactNode;
  showSelfHostedMessage?: boolean;
};

function FeedbackModalBody({
  children: bodyChildren,
  showSelfHostedMessage = true,
}: BodyProps) {
  const {Body, isSelfHosted} = useFeedbackModalContext();
  return (
    <Body>
      {bodyChildren}
      {isSelfHosted && showSelfHostedMessage && (
        <Alert.Container>
          <Alert variant="info" showIcon={false}>
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
}

/**
 * A modal that allows users to submit feedback to Sentry (feedbacks project).
 *
 * @deprecated Use `<FeedbackButton/>` instead.
 */
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
  const [state, setState] = useState(
    props.children === undefined
      ? ({subject: undefined, additionalInfo: undefined} as unknown as T)
      : props.initialData
  );
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  const project = useMemo(() => {
    if (projectsLoaded && location.query.project) {
      return projects.find(p => p.id === location.query.project);
    }
    return;
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
            ...submitEventData,
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

  function handleFieldChange<Field extends keyof T>(field: Field, value: T[Field]) {
    const newState = cloneDeep(state);
    newState[field] = value;
    setState(newState);
  }

  const contextValue: FeedbackModalContextValue = useMemo(
    () => ({
      Header,
      Body,
      Footer,
      closeModal,
      handleSubmit,
      isSelfHosted,
      isScreenSmall,
      isCustomChildren: props.children !== undefined,
      state,
    }),
    [
      Header,
      Body,
      Footer,
      closeModal,
      handleSubmit,
      isSelfHosted,
      isScreenSmall,
      props.children,
      state,
    ]
  );

  if (props.children === undefined) {
    const feedbackTypes = props.feedbackTypes ?? defaultFeedbackTypes;

    return (
      <FeedbackModalContext.Provider value={contextValue}>
        <Fragment>
          <FeedbackModalHeader>{t('Submit Feedback')}</FeedbackModalHeader>
          <FeedbackModalBody>
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
              <TextArea
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
          </FeedbackModalBody>
          <FeedbackModalFooter secondaryAction={props?.secondaryAction} />
        </Fragment>
      </FeedbackModalContext.Provider>
    );
  }

  return (
    <FeedbackModalContext.Provider value={contextValue}>
      <Fragment>
        {props.children({
          Header: FeedbackModalHeader,
          Body: FeedbackModalBody,
          Footer: FeedbackModalFooter,
          onFieldChange: handleFieldChange,
          state,
        })}
      </Fragment>
    </FeedbackModalContext.Provider>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
