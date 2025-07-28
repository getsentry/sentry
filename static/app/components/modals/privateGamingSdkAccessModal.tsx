import {Fragment, useState} from 'react';
import {captureFeedback} from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useUser} from 'sentry/utils/useUser';

const PRIVATE_GAMING_SDK_OPTIONS = [
  {value: 'playstation', label: 'PlayStation'},
  {value: 'xbox', label: 'Xbox'},
  {value: 'nintendo-switch', label: 'Nintendo Switch'},
] as const;

type GamingPlatform = (typeof PRIVATE_GAMING_SDK_OPTIONS)[number]['value'];

export interface PrivateGamingSdkAccessModalProps {
  organization: Organization;
  projectSlug: string;
  sdkName: string;
  gamingPlatform?: GamingPlatform;
  onSubmit?: () => void;
}

export function PrivateGamingSdkAccessModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  projectSlug,
  sdkName,
  gamingPlatform,
  onSubmit,
}: PrivateGamingSdkAccessModalProps & ModalRenderProps) {
  const user = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubProfile, setGithubProfile] = useState('');
  const [gamingPlatforms, setGamingPlatforms] = useState<string[]>(
    gamingPlatform ? [gamingPlatform] : []
  );

  const isFormValid = !!githubProfile.trim() && gamingPlatforms.length > 0;

  function handleSubmit() {
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);

    onSubmit?.();

    const messageBody = [
      `User: ${user.name}`,
      `Email: ${user.email}`,
      gamingPlatforms.length === 1
        ? `Platform: ${gamingPlatforms[0]}`
        : `Platforms: ${gamingPlatforms
            .map(
              (platform: string) =>
                PRIVATE_GAMING_SDK_OPTIONS.find(option => option.value === platform)
                  ?.label || platform
            )
            .join(', ')}`,
      `Org Slug: ${organization.slug}`,
      `Project: ${projectSlug}`,
      `GitHub Profile: ${githubProfile}`,
    ].join('\n');

    const source = `${sdkName.toLowerCase()}-sdk-access`;

    // Use captureFeedback with proper user context instead of tags
    captureFeedback(
      {
        message: messageBody,
        name: user.name,
        email: user.email,
        source,
        tags: {
          feature: source,
        },
      },
      {
        captureContext: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
          },
        },
      }
    );

    addSuccessMessage(
      tct('Your [sdkName] SDK access request has been submitted.', {
        sdkName,
      })
    );
    setIsSubmitting(false);
    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton>
        <h3>
          {tct('Request [sdkName] SDK Access', {
            sdkName,
          })}
        </h3>
      </Header>
      <Body>
        <p>
          {gamingPlatform
            ? tct(
                'Request access to our [sdkName] SDK. Please provide your GitHub profile.',
                {
                  sdkName,
                }
              )
            : tct(
                'Request access to our [sdkName] SDK. Please provide your GitHub profile and the gaming platforms you work with.',
                {
                  sdkName,
                }
              )}
        </p>
        <TextField
          name="githubProfile"
          label={t('Link to your GitHub profile')}
          placeholder="https://github.com/username"
          value={githubProfile}
          onChange={setGithubProfile}
          required
          stacked
          inline={false}
        />
        {!gamingPlatform && (
          <SelectField
            name="gamingPlatforms"
            label={t('Select Gaming Platform')}
            placeholder={t('Select one or more gaming platforms')}
            options={PRIVATE_GAMING_SDK_OPTIONS}
            value={gamingPlatforms}
            onChange={setGamingPlatforms}
            multiple
            required
            stacked
            inline={false}
          />
        )}
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? t('Submitting\u2026') : t('Submit Request')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
