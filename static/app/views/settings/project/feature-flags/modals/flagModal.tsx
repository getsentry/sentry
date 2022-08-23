import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TextareaField, TextField} from 'sentry/components/forms';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {FeatureFlags} from 'sentry/types/featureFlags';
import useApi from 'sentry/utils/useApi';

type Props = ModalRenderProps & {
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  flagKey?: string;
};

export function FlagModal({
  Header,
  Body,
  Footer,
  closeModal,
  flags,
  flagKey,
  organization,
  project,
}: Props) {
  const api = useApi();

  const [key, setKey] = useState(flagKey ?? '');
  const [description, setDescription] = useState(
    flagKey ? flags[flagKey].description : ''
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    if (!!error) {
      return;
    }

    setIsSaving(true);

    const newFlags = {...flags};

    let newFeatureFlags = {
      ...flags,
      [key]: {description, enabled: false, evaluations: []},
    };

    if (flagKey) {
      delete newFlags[flagKey];
      newFeatureFlags = {
        ...newFlags,
        [key]: {...flags[flagKey], description},
      };
    }

    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );

      ProjectStore.onUpdateSuccess(response);

      addSuccessMessage(
        flagKey
          ? t('Successfully edited feature flag')
          : t('Successfully added feature flag')
      );
      closeModal();
    } catch (err) {
      addErrorMessage(err);
    }

    setIsSaving(false);
  }

  const submitDisabled = !key || !!error;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{flagKey ? t('Edit Flag') : t('Add Flag')}</h4>
      </Header>
      <Body>
        <KeyField
          label={t('Key')}
          name="key"
          onChange={value => {
            setKey(value);

            if (!value) {
              setError(t('Key is required'));
              return;
            }

            if (value.includes(' ')) {
              setError(t('Key cannot contain spaces'));
              return;
            }

            if (flags[value]) {
              setError(t('This key is already in use'));
              return;
            }

            setError(undefined);
          }}
          onKeyDown={(_value: string, e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          value={key}
          inline={false}
          hideControlState={!error}
          error={error}
          stacked
          required
        />
        <DescriptionField
          label={t('Description')}
          name="description"
          onChange={setDescription}
          onKeyDown={(_value: string, e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          value={description}
          inline={false}
          rows={2}
          autosize
          hideControlState
          stacked
        />
      </Body>
      <Footer>
        <FooterActions>
          <Button href="" external>
            {t('Read Docs')}
          </Button>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              onClick={handleSubmit}
              title={submitDisabled ? t('Required fields must be filled out') : undefined}
              disabled={submitDisabled || isSaving}
            >
              {t('Save')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

export const KeyField = styled(TextField)`
  width: 100%;
  input {
    padding-left: ${space(1)};
  }
`;

export const DescriptionField = styled(TextareaField)`
  width: 100%;
`;

export const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;
