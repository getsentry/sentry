import {Fragment, useCallback, useState} from 'react';
import {captureFeedback} from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

interface Props {
  organization: Organization;
  project: Project;
}

interface PlayStationSdkAccessModalProps extends ModalRenderProps, Props {}

interface FormData {
  gameEngines: string[];
  githubProfile: string;
}

const GAME_ENGINE_OPTIONS = [
  {value: 'unity', label: 'Unity'},
  {value: 'unreal', label: 'Unreal'},
  {value: 'godot', label: 'Godot'},
  {value: 'private-engine', label: 'Private Engine'},
  {value: 'other', label: 'Other'},
];

export default function PlayStationSdkAccessModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  project,
}: PlayStationSdkAccessModalProps) {
  const user = useUser();
  const [formData, setFormData] = useState<FormData>({
    githubProfile: '',
    gameEngines: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!formData.githubProfile || formData.gameEngines.length === 0) {
      return;
    }

    setIsSubmitting(true);

    trackAnalytics('tempest.sdk_access_request_submitted', {
      organization,
      project_slug: project.slug,
      game_engines: formData.gameEngines,
    });

    // Format the message body with user details, engines, and org slug
    const messageBody = [
      `User: ${user.name || 'No Name'}`,
      `Email: ${user.email || 'No Email'}`,
      `Engines: ${formData.gameEngines
        .map(
          (engine: string) =>
            GAME_ENGINE_OPTIONS.find(option => option.value === engine)?.label || engine
        )
        .join(', ')}`,
      `Org Slug: ${organization.slug}`,
      `GitHub Profile: ${formData.githubProfile}`,
    ].join('\n');

    // Use captureFeedback with proper user context instead of tags
    captureFeedback(
      {
        message: messageBody,
        name: user.name,
        email: user.email,
        source: 'playstation-sdk-access',
        tags: {
          feature: 'playstation-sdk-access',
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

    addSuccessMessage(t('Your PlayStation SDK access request has been submitted!'));
    setIsSubmitting(false);
    closeModal();
  }, [formData, organization, project, user, closeModal]);

  const isFormValid = formData.githubProfile.trim() && formData.gameEngines.length > 0;

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Request PlayStation SDK Access')}</h3>
      </Header>
      <Body>
        <p>
          {t(
            'Request access to our PlayStation SDK. Please provide your GitHub profile and the game engines you work with.'
          )}
        </p>
        <TextField
          name="githubProfile"
          label={t('Link to your GitHub profile')}
          placeholder="https://github.com/username"
          value={formData.githubProfile}
          onChange={(value: string) =>
            setFormData(prev => ({...prev, githubProfile: value}))
          }
          required
          stacked
          inline={false}
        />
        <SelectField
          name="gameEngines"
          label={t('Select Game Engine')}
          placeholder={t('Select one or more game engines')}
          options={GAME_ENGINE_OPTIONS}
          value={formData.gameEngines}
          onChange={(value: string[]) =>
            setFormData(prev => ({...prev, gameEngines: value}))
          }
          multiple
          required
          stacked
          inline={false}
        />
      </Body>
      <Footer>
        <ButtonBar gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? t('Submitting...') : t('Submit Request')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
