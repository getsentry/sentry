import {type ChangeEvent, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconChevron as IconExpandToggle, IconClose, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';

interface Props {
  onRemove: () => void;
  onSettingsChange: (settings: RepoSettings) => void;
  repo: Repository;
  settings: RepoSettings;
}

export function SelectedRepoItem({repo, onRemove, settings, onSettingsChange}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [branchInputValue, setBranchInputValue] = useState(settings.branch);
  const [instructionsValue, setInstructionsValue] = useState(settings.instructions);
  const [originalValues, setOriginalValues] = useState({
    branch: settings.branch,
    instructions: settings.instructions,
  });
  const [isDirty, setIsDirty] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    setBranchInputValue(settings.branch);
    setInstructionsValue(settings.instructions);
    setOriginalValues({
      branch: settings.branch,
      instructions: settings.instructions,
    });
    setIsDirty(false);
  }, [settings.branch, settings.instructions]);

  useEffect(() => {
    const newIsDirty =
      branchInputValue !== originalValues.branch ||
      instructionsValue !== originalValues.instructions;
    setIsDirty(newIsDirty);
  }, [branchInputValue, instructionsValue, originalValues]);

  const handleBranchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setBranchInputValue(e.target.value);
  };

  const handleInstructionsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setInstructionsValue(e.target.value);
  };

  const saveChanges = () => {
    onSettingsChange({
      branch: branchInputValue,
      instructions: instructionsValue,
    });
    setIsEditingBranch(false);
  };

  const cancelChanges = () => {
    setBranchInputValue(originalValues.branch);
    setInstructionsValue(originalValues.instructions);
    setIsEditingBranch(false);
    setIsDirty(false);
  };

  return (
    <SelectedRepoContainer>
      <SelectedRepoHeader onClick={toggleExpanded}>
        <RepoNameAndExpandToggle>
          <StyledIconExpandToggle direction={isExpanded ? 'down' : 'right'} size="xs" />
          <RepoInfoWrapper>
            <RepoName>{repo.name}</RepoName>
            <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>
          </RepoInfoWrapper>
        </RepoNameAndExpandToggle>
        <RemoveButton
          size="xs"
          borderless
          icon={<IconClose size="xs" />}
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t('Remove repository')}
          title={t('Remove repository')}
        />
      </SelectedRepoHeader>
      {isExpanded && (
        <ExpandedContent>
          <RepoForm>
            <RepositorySettingsSection>
              <SettingsGroup>
                <BranchInputLabel>
                  {t('Branch that Autofix works on')}
                  <QuestionTooltip
                    title={t(
                      'Optionally provide a specific branch that Autofix will work on. If left blank, Autofix will use the default branch of the repository.'
                    )}
                    size="sm"
                  />
                </BranchInputLabel>

                <BranchInputContainer>
                  <InputGroup>
                    <InputGroup.LeadingItems disablePointerEvents>
                      <IconCommit size="sm" />
                    </InputGroup.LeadingItems>
                    <InputGroup.Input
                      type="text"
                      value={isEditingBranch ? branchInputValue : settings.branch}
                      onChange={handleBranchInputChange}
                      onFocus={() => !isEditingBranch && setIsEditingBranch(true)}
                      placeholder={t('Default branch')}
                      autoFocus={isEditingBranch && !settings.branch}
                    />
                    {(isEditingBranch ? branchInputValue : settings.branch) && (
                      <InputGroup.TrailingItems>
                        <ClearButton
                          size="xs"
                          borderless
                          icon={<IconClose size="xs" />}
                          onClick={() => {
                            setBranchInputValue('');
                            if (!isEditingBranch) {
                              setIsEditingBranch(true);
                            }
                            setIsDirty(true);
                          }}
                          aria-label={t('Clear branch and use default')}
                          title={t('Clear branch and use default')}
                        />
                      </InputGroup.TrailingItems>
                    )}
                  </InputGroup>
                </BranchInputContainer>
              </SettingsGroup>

              <SettingsGroup>
                <BranchInputLabel>{t('Instructions for Autofix')}</BranchInputLabel>
                <StyledTextArea
                  value={instructionsValue}
                  onChange={handleInstructionsChange}
                  placeholder={t(
                    'Any special instructions for Autofix in this repository...'
                  )}
                  rows={3}
                />
              </SettingsGroup>
            </RepositorySettingsSection>

            {isDirty && (
              <FormActions>
                <Button size="xs" onClick={cancelChanges}>
                  {t('Cancel')}
                </Button>
                <Button size="xs" priority="primary" onClick={saveChanges}>
                  {t('Save')}
                </Button>
              </FormActions>
            )}
          </RepoForm>
        </ExpandedContent>
      )}
    </SelectedRepoContainer>
  );
}

const BaseRepoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SelectedRepoContainer = styled(BaseRepoContainer)``;

const SelectedRepoHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1.5)};
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const RepoNameAndExpandToggle = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconExpandToggle = styled(IconExpandToggle)`
  margin-right: ${space(0.5)};
`;

const RemoveButton = styled(Button)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.red300};
  }
`;

const RepoInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(1)};
`;

const RepoName = styled('div')`
  font-weight: 600;
`;

const RepoProvider = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const ExpandedContent = styled('div')`
  padding: ${space(1.5)};
  background-color: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const RepositorySettingsSection = styled('div')``;

const SettingsGroup = styled('div')`
  margin-bottom: ${space(2)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const BranchInputLabel = styled('label')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
  margin-bottom: ${space(0.5)};
  gap: ${space(0.5)};
`;

const BranchInputContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const RepoForm = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const FormActions = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  margin-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  padding-top: ${space(2)};
`;

const StyledTextArea = styled('textarea')`
  width: 100%;
  padding: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  background-color: ${p => p.theme.background};
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.focus};
    box-shadow: ${p => p.theme.focusBorder};
  }

  &::placeholder {
    color: ${p => p.theme.gray300};
  }
`;

const ClearButton = styled(Button)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;
