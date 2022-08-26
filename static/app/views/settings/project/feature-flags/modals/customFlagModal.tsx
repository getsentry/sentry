import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TextareaField, TextField} from 'sentry/components/forms';
import SelectField from 'sentry/components/forms/selectField';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {FeatureFlag, FeatureFlagKind, FeatureFlags} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

type Props = ModalRenderProps & {
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  flagKey?: string;
};

export function CustomFlagModal({
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
  const [name, setName] = useState(flagKey ? flags[flagKey].name : '');
  const [description, setDescription] = useState(
    flagKey ? flags[flagKey].description : ''
  );
  const [kind, setKind] = useState<FeatureFlagKind>(
    flagKey ? flags[flagKey].kind : FeatureFlagKind.BOOLEAN
  );
  const [group, setGroup] = useState(flagKey ? flags[flagKey].group : '');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    if (!!error) {
      return;
    }

    setIsSaving(true);

    const newFlags = {...flags};

    let newFlag: FeatureFlag = {
      description,
      enabled: false,
      custom: true,
      kind,
      group,
      evaluation: [],
      name,
    };

    if (defined(flagKey)) {
      // if the flag key changed, delete the old entry.
      delete newFlags[flagKey];

      newFlag = {
        ...flags[flagKey],
        kind,
        description,
        group,
        name,
      };
    }

    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {
            featureFlags: {
              ...flags,
              [key]: newFlag,
            },
          },
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
  const canUpdateKind = defined(flagKey) ? flags[flagKey].evaluation.length === 0 : true;

  const nameChoices = [] as string[][];

  if (!nameChoices.some(nameChoice => nameChoice[0] === key)) {
    nameChoices.push([key, key]);
  }

  function handleKeyChange(value: string) {
    setKey(value);

    if (!value) {
      setError(t('Name is required'));
      return;
    }

    if (value.includes(' ')) {
      setError(t('Name cannot contain spaces'));
      return;
    }

    if (flags[value]) {
      setError(t('This key is already in use'));
      return;
    }

    if (value.substring(0, 2) === '@@') {
      setError(t('Reserved key'));
      return;
    }

    setError(undefined);
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{flagKey ? t('Edit Custom Flag') : t('Add Custom Flag')}</h4>
      </Header>
      <Body>
        <Fields>
          <StyledTextField
            name="key"
            label={t('Key')}
            placeholder={t('Enter a key')}
            value={key}
            onKeyDown={(val: string, e: KeyboardEvent) => {
              if (e.key === 'Tab') {
                handleKeyChange(val);
              }
            }}
            onChange={handleKeyChange}
            error={error}
            inline={false}
            hideControlState={!error}
            required
          />
          <StyledTooltip
            title={
              !canUpdateKind
                ? t('You cannot change the kind of a flag with segments')
                : undefined
            }
            disabled={canUpdateKind}
          >
            <StyledSelectField
              name="kind"
              label={t('Kind')}
              value={kind}
              choices={Object.values(FeatureFlagKind).map(value => [
                value,
                startCase(value),
              ])}
              onChange={setKind}
              inline={false}
              hideControlState
              required
              disabled={!canUpdateKind}
            />
          </StyledTooltip>
          <StyledTextField
            name="name"
            label={t('Name')}
            placeholder={t('Enter a Name')}
            value={name}
            onKeyDown={(val: string, e: KeyboardEvent) => {
              if (e.key === 'Tab') {
                setName(val);
              }
            }}
            onChange={setName}
            error={error}
            inline={false}
            hideControlState={!error}
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
          <StyledTextField
            label={t('Group')}
            placeholder={key}
            inline={false}
            value={group}
            onChange={value => setGroup(value ?? '')}
            onKeyDown={(_value: string, e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            help={t(
              'If two flags share the same group, they will be linked together for an applied rollout. You can leave this empty and the flag name is used.'
            )}
            hideControlState
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

const Fields = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const DescriptionField = styled(TextareaField)`
  width: 100%;
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
  border-bottom: none;
  width: 100%;
`;

const StyledTextField = styled(TextField)`
  padding: 0;
  border-bottom: none;
  width: 100%;
`;

const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;
