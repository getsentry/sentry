import {type ChangeEvent, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {TextArea} from 'sentry/components/core/textarea';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {
  IconChevron as IconExpandToggle,
  IconClose,
  IconCommit,
  IconDelete,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';

interface Props {
  onRemove: () => void;
  onSettingsChange: (settings: RepoSettings) => void;
  repo: Repository;
  settings: RepoSettings;
}

export function AutofixRepoItem({repo, onRemove, settings, onSettingsChange}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      <SelectedRepoHeader role="button" onClick={toggleExpanded}>
        <InteractionStateLayer />
        <RepoNameAndExpandToggle>
          <StyledIconExpandToggle direction={isExpanded ? 'up' : 'down'} size="xs" />
          <RepoInfoWrapper>
            <RepoName>{repo.name}</RepoName>
          </RepoInfoWrapper>
        </RepoNameAndExpandToggle>
        <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>
      </SelectedRepoHeader>
      {isExpanded && (
        <ExpandedContent>
          <RepoForm>
            <div>
              <SettingsGroup>
                <BranchInputLabel>
                  {t('Branch that Seer works on')}
                  <QuestionTooltip
                    title={t(
                      'Optionally provide a specific branch that Seer will work on. If left blank, Seer will use the default branch of the repository.'
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
                <BranchInputLabel>{t('Context for Seer')}</BranchInputLabel>
                <StyledTextArea
                  value={instructionsValue}
                  onChange={handleInstructionsChange}
                  placeholder={t(
                    'Add any general context or instructions to help Seer understand this repository...'
                  )}
                  rows={3}
                />
              </SettingsGroup>
            </div>
            <FormActions>
              <Confirm
                onConfirm={onRemove}
                message={tct('Are you sure you want to remove [repo] from Seer?', {
                  repo: <strong>{repo.name}</strong>,
                })}
              >
                <Button size="sm" redesign icon={<IconDelete redesign />}>
                  {t('Remove Repository')}
                </Button>
              </Confirm>
              {isDirty && (
                <ButtonBar gap={0.5}>
                  <Button size="sm" redesign onClick={cancelChanges}>
                    {t('Cancel')}
                  </Button>
                  <Button size="sm" redesign priority="primary" onClick={saveChanges}>
                    {t('Save')}
                  </Button>
                </ButtonBar>
              )}
            </FormActions>
          </RepoForm>
        </ExpandedContent>
      )}
    </SelectedRepoContainer>
  );
}

const SelectedRepoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
`;

const SelectedRepoHeader = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1.5)} ${space(3)};
  cursor: pointer;
`;

const RepoName = styled('div')`
  font-weight: 600;
`;

const RepoProvider = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const ExpandedContent = styled('div')`
  padding: ${space(1)} ${space(2)} ${space(1)} 40px;
  background-color: ${p => p.theme.background};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const SettingsGroup = styled('div')`
  margin-bottom: ${space(2)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const BranchInputLabel = styled('label')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.md};
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
  gap: ${space(1)};
  width: 100%;
`;

const FormActions = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const StyledTextArea = styled(TextArea)`
  width: 100%;
  resize: vertical;
  min-height: 80px;
`;

const ClearButton = styled(Button)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;

const RepoNameAndExpandToggle = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconExpandToggle = styled(IconExpandToggle)`
  margin-right: ${space(0.5)};
`;

const RepoInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(1)};
`;
