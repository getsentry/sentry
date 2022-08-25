import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TextareaField} from 'sentry/components/forms';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {FeatureFlags} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

import {preDefinedFeatureFlags} from './utils';

type Props = ModalRenderProps & {
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  flagKey?: string;
};

export function PreDefinedFlagModal({
  Header,
  Body,
  Footer,
  closeModal,
  flags,
  flagKey,
  organization,
  project,
}: Props) {
  const preDefinedFlagsChoices = Object.keys(preDefinedFeatureFlags)
    .map(key => [key, key])
    .filter(key => !flags[key[0]] || key[0] === flagKey);

  const api = useApi();
  const [isSaving, setIsSaving] = useState(false);
  const [key, setKey] = useState(flagKey ? flagKey : preDefinedFlagsChoices[0][0]);
  const [description, setDescription] = useState(
    flagKey ? flags[flagKey].description : ''
  );

  async function handleSubmit() {
    setIsSaving(true);

    const newFlags = {...flags};

    let newFeatureFlags = {
      ...flags,
      [key]: {
        ...preDefinedFeatureFlags[key],
        description,
      },
    };

    // if the flag key changed, delete the old entry.
    if (defined(flagKey)) {
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

  return (
    <Fragment>
      <Header closeButton>
        <h4>{flagKey ? t('Edit Predefined Flag') : t('Add Predefined Flag')}</h4>
      </Header>
      <Body>
        <Fields>
          <StyledSelectField
            name="type"
            label={t('Predefined Flag')}
            value={key}
            defaultValue={key}
            choices={preDefinedFlagsChoices}
            onChange={setKey}
            inline={false}
            hideControlState
            required
          />
          <DescriptionField
            label={t('Description')}
            placeholder={t(
              'What this feature flag does if active? Help other users understand why this feature is important by describing it.'
            )}
            name="description"
            onChange={setDescription}
            onKeyDown={(_value: string, e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            value={description}
            inline={false}
            rows={4}
            autosize
            hideControlState
            stacked
          />
        </Fields>
      </Body>
      <Footer>
        <FooterActions>
          <Button href="" external>
            {t('Read Docs')}
          </Button>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button priority="primary" onClick={handleSubmit} disabled={isSaving}>
              {t('Save')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const Fields = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
  border-bottom: none;
  width: 100%;
`;

const DescriptionField = styled(TextareaField)`
  width: 100%;
  padding: 0;
`;
