import {Fragment, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useUser} from 'sentry/utils/useUser';

const PRIVATE_GAMING_SDK_OPTIONS = [
  {value: 'playstation', label: 'PlayStation'},
  {value: 'xbox', label: 'Xbox'},
  {value: 'nintendo-switch', label: 'Nintendo Switch'},
] as const;

type GamingPlatform = (typeof PRIVATE_GAMING_SDK_OPTIONS)[number]['value'];

export interface PrivateGamingSdkAccessModalProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings';
  projectId: string;
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
  projectId,
  onSubmit,
  origin,
}: PrivateGamingSdkAccessModalProps & ModalRenderProps) {
  const user = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubProfile, setGithubProfile] = useState('');
  const [gamingPlatforms, setGamingPlatforms] = useState<string[]>(
    gamingPlatform ? [gamingPlatform] : []
  );
  const [requestError, setRequestError] = useState<string | undefined>(undefined);

  const isFormValid = !!githubProfile.trim() && gamingPlatforms.length > 0;

  useEffect(() => {
    trackAnalytics('gaming.private_sdk_access_modal_opened', {
      platform: gamingPlatform,
      project_id: projectId,
      organization,
      origin,
    });
  }, [gamingPlatform, organization, projectId, origin]);

  async function handleSubmit() {
    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    setRequestError(undefined);

    trackAnalytics('gaming.private_sdk_access_modal_submitted', {
      platforms: gamingPlatforms,
      project_id: projectId,
      platform: gamingPlatform,
      organization,
      origin,
    });

    onSubmit?.();

    const messageBody = [
      `This is a request for SDK access for consoles. The user's details are:`,
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

    try {
      await Sentry.sendFeedback(
        {
          message: messageBody,
          name: user.name,
          email: user.email,
          tags: {
            feature: 'console-sdk-access',
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
      closeModal();
    } catch (error: any) {
      handleXhrErrorResponse(t('Unable to submit SDK access request'), error);

      setRequestError(
        // Ideally, we’d get an error code to use with our translation functions for showing the right message, but the API currently only returns a plain string.
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : t(
                'Unable to submit the request. This could be because of network issues, or because you are using an ad-blocker.'
              )
      );
    } finally {
      setIsSubmitting(false);
    }
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
        {requestError && <Alert type="danger">{requestError}</Alert>}
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={handleSubmit}
            disabled={!isFormValid}
            busy={isSubmitting}
          >
            {isSubmitting ? t('Submitting\u2026') : t('Submit Request')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
