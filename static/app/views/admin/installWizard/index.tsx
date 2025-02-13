import {css} from '@emotion/react';
import styled from '@emotion/styled';

import sentryPattern from 'sentry-images/pattern/sentry-pattern.png';

import {Alert} from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {Field} from '../options';
import {getForm, getOptionDefault, getOptionField} from '../options';

export type InstallWizardProps = {
  onConfigured: () => void;
};

export type InstallWizardOptions = Record<
  string,
  {
    field: Field;
    value?: unknown;
  }
>;

export default function InstallWizard({onConfigured}: InstallWizardProps) {
  const {
    data: options,
    isPending,
    isError,
  } = useApiQuery<InstallWizardOptions>(['/internal/options/?query=is:required'], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <Alert.Container>
        <Alert margin type="error" showIcon>
          {t(
            'We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.'
          )}
        </Alert>
      </Alert.Container>
    );
  }

  const renderFormFields = () => {
    let missingOptions = new Set(
      Object.keys(options).filter(option => !options[option]!.field.isSet)
    );
    // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.
    if (missingOptions.size === 0) {
      missingOptions = new Set(Object.keys(options));
    }

    // A mapping of option name to Field object
    const fields: Record<string, React.ReactNode> = {};

    for (const key of missingOptions) {
      const option = options[key]!;
      if (option.field.disabled) {
        continue;
      }
      fields[key] = getOptionField(key, option.field);
    }

    return getForm(fields);
  };

  const getInitialData = () => {
    const data = {};
    Object.keys(options).forEach(optionName => {
      const option = options[optionName]!;
      if (option.field.disabled) {
        return;
      }

      // TODO(dcramer): we need to rethink this logic as doing multiple "is this value actually set"
      // is problematic
      // all values to their server-defaults (as client-side defaults don't really work)
      const displayValue = option.value || getOptionDefault(optionName);
      if (
        // XXX(dcramer): we need the user to explicitly choose beacon.anonymous
        // vs using an implied default so effectively this is binding
        optionName !== 'beacon.anonymous' &&
        // XXX(byk): if we don't have a set value but have a default value filled
        // instead, from the client, set it on the data so it is sent to the server
        !option.field.isSet &&
        displayValue !== undefined
      ) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data[optionName] = displayValue;
      }
    });
    return data;
  };

  const version = ConfigStore.get('version');
  return (
    <SentryDocumentTitle noSuffix title={t('Setup Sentry')}>
      <Wrapper>
        <Pattern />
        <SetupWizard>
          <Heading>
            <span>{t('Welcome to Sentry')}</span>
            <Version>{version.current}</Version>
          </Heading>
          <Form
            apiMethod="PUT"
            apiEndpoint={'/internal/options/?query=is:required'}
            submitLabel={t('Continue')}
            initialData={getInitialData()}
            onSubmitSuccess={onConfigured}
          >
            <p>{t('Complete setup by filling out the required configuration.')}</p>

            {renderFormFields()}
          </Form>
        </SetupWizard>
      </Wrapper>
    </SentryDocumentTitle>
  );
}

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
`;

const fixedStyle = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Pattern = styled('div')`
  z-index: -1;

  &::before {
    ${fixedStyle}
    content: '';
    background-image: linear-gradient(
      to right,
      ${p => p.theme.purple200} 0%,
      ${p => p.theme.purple300} 100%
    );
    background-repeat: repeat-y;
  }

  &::after {
    ${fixedStyle}
    content: '';
    background: url(${sentryPattern});
    background-size: 400px;
    opacity: 0.8;
  }
`;

const Heading = styled('h1')`
  display: grid;
  gap: ${space(1)};
  justify-content: space-between;
  grid-auto-flow: column;
  line-height: 36px;
`;

const Version = styled('small')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: inherit;
`;

const SetupWizard = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  margin-top: 40px;
  padding: 40px 40px 20px;
  width: 600px;
  z-index: ${p => p.theme.zIndex.initial};
`;
