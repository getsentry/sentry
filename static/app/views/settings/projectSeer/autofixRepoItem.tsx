import {useEffect, useState, type ChangeEvent} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {TextArea} from 'sentry/components/core/textarea';
import type {BranchOverride, RepoSettings} from 'sentry/components/events/autofix/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {
  IconAdd,
  IconClose,
  IconCommit,
  IconDelete,
  IconChevron as IconExpandToggle,
  IconTag,
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
  const [branchOverridesValue, setBranchOverridesValue] = useState<BranchOverride[]>(
    settings.branch_overrides || []
  );
  const [originalValues, setOriginalValues] = useState({
    branch: settings.branch,
    instructions: settings.instructions,
    branch_overrides: settings.branch_overrides || [],
  });
  const [isDirty, setIsDirty] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setBranchInputValue(settings.branch);
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setInstructionsValue(settings.instructions);
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setBranchOverridesValue(settings.branch_overrides || []);
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setOriginalValues({
      branch: settings.branch,
      instructions: settings.instructions,
      branch_overrides: settings.branch_overrides || [],
    });
    setIsDirty(false);
  }, [settings.branch, settings.instructions, settings.branch_overrides]);

  useEffect(() => {
    const newIsDirty =
      branchInputValue !== originalValues.branch ||
      instructionsValue !== originalValues.instructions ||
      JSON.stringify(branchOverridesValue) !==
        JSON.stringify(originalValues.branch_overrides);
    setIsDirty(newIsDirty);
  }, [branchInputValue, instructionsValue, branchOverridesValue, originalValues]);

  const handleBranchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setBranchInputValue(e.target.value);
  };

  const handleInstructionsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setInstructionsValue(e.target.value);
  };

  const saveChanges = () => {
    // Filter out incomplete branch overrides - all fields must be filled
    const completeOverrides = branchOverridesValue.filter(
      override =>
        override.tag_name.trim() !== '' &&
        override.tag_value.trim() !== '' &&
        override.branch_name.trim() !== ''
    );

    onSettingsChange({
      branch: branchInputValue,
      instructions: instructionsValue,
      branch_overrides: completeOverrides,
    });
    setIsEditingBranch(false);
  };

  const cancelChanges = () => {
    setBranchInputValue(originalValues.branch);
    setInstructionsValue(originalValues.instructions);
    setBranchOverridesValue(originalValues.branch_overrides);
    setIsEditingBranch(false);
    setIsDirty(false);
  };

  const addBranchOverride = () => {
    setBranchOverridesValue([
      ...branchOverridesValue,
      {tag_name: '', tag_value: '', branch_name: ''},
    ]);
  };

  const updateBranchOverride = (index: number, override: BranchOverride) => {
    const newOverrides = [...branchOverridesValue];
    newOverrides[index] = override;
    setBranchOverridesValue(newOverrides);
  };

  const removeBranchOverride = (index: number) => {
    setBranchOverridesValue(branchOverridesValue.filter((_, i) => i !== index));
  };

  return (
    <SelectedRepoContainer>
      <SelectedRepoHeader role="button" onClick={toggleExpanded}>
        <InteractionStateLayer />
        <Flex align="center">
          <StyledIconExpandToggle direction={isExpanded ? 'up' : 'down'} size="xs" />
          <RepoInfoWrapper>
            <RepoName>{repo.name}</RepoName>
          </RepoInfoWrapper>
        </Flex>
        <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>
      </SelectedRepoHeader>
      {isExpanded && (
        <ExpandedContent>
          <RepoForm>
            <div>
              <SettingsGroup>
                <BranchInputLabel>
                  {t('Working Branch for Seer')}
                  <QuestionTooltip
                    title={t(
                      'Optionally provide a specific branch that Seer will work on. If left blank, Seer will use the default branch of the repository.'
                    )}
                    size="sm"
                  />
                </BranchInputLabel>

                <BranchInputContainer>
                  <SubHeader>{t('By default, look at')}</SubHeader>

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
                  <AddOverrideButton
                    size="xs"
                    icon={<IconAdd />}
                    onClick={addBranchOverride}
                    borderless
                  >
                    {t('Add an override for a tag')}
                  </AddOverrideButton>
                  <QuestionTooltip
                    title={t(
                      'Configure different branches to use based on event tags. For example, use a staging branch for events tagged with environment=staging.'
                    )}
                    size="sm"
                  />
                </BranchInputContainer>

                <BranchOverridesList>
                  {branchOverridesValue.map((override, index) => (
                    <BranchOverrideItem key={index}>
                      <BranchOverrideFields>
                        <SubHeader>{t('When')}</SubHeader>
                        <OverrideInputGroup>
                          <InputGroup.LeadingItems disablePointerEvents>
                            <IconTag size="sm" />
                          </InputGroup.LeadingItems>
                          <InputGroup.Input
                            type="text"
                            value={override.tag_name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateBranchOverride(index, {
                                ...override,
                                tag_name: e.target.value,
                              })
                            }
                            placeholder={t('Tag name (e.g. environment)')}
                          />
                        </OverrideInputGroup>
                        <SubHeader>{t('is')}</SubHeader>
                        <OverrideInputGroup>
                          <InputGroup.Input
                            type="text"
                            value={override.tag_value}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateBranchOverride(index, {
                                ...override,
                                tag_value: e.target.value,
                              })
                            }
                            placeholder={t('Tag value (e.g. staging)')}
                          />
                        </OverrideInputGroup>
                        <SubHeader>{t('look at')}</SubHeader>
                        <OverrideInputGroup>
                          <InputGroup.LeadingItems disablePointerEvents>
                            <IconCommit size="sm" />
                          </InputGroup.LeadingItems>
                          <InputGroup.Input
                            type="text"
                            value={override.branch_name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              updateBranchOverride(index, {
                                ...override,
                                branch_name: e.target.value,
                              })
                            }
                            placeholder={t('Branch name (e.g. dev)')}
                          />
                        </OverrideInputGroup>
                      </BranchOverrideFields>
                      <Button
                        size="sm"
                        borderless
                        icon={<IconDelete size="sm" variant="muted" />}
                        onClick={() => removeBranchOverride(index)}
                        aria-label={t('Remove override')}
                        title={t('Remove override')}
                      />
                    </BranchOverrideItem>
                  ))}
                </BranchOverridesList>
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
                <Button size="sm" icon={<IconDelete />}>
                  {t('Remove Repository')}
                </Button>
              </Confirm>
              {isDirty && (
                <ButtonBar gap="xs">
                  <Button size="md" onClick={cancelChanges}>
                    {t('Cancel')}
                  </Button>
                  <Button size="md" priority="primary" onClick={saveChanges}>
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
  color: ${p => p.theme.tokens.content.secondary};
  margin-top: ${space(0.25)};
`;

const ExpandedContent = styled('div')`
  padding: 0 ${space(2)} ${space(1)} 40px;
  background-color: ${p => p.theme.tokens.background.primary};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const SettingsGroup = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding-bottom: ${p => p.theme.space.lg};
  padding-top: ${p => p.theme.space.lg};

  &:last-child {
    margin-bottom: 0;
  }
`;

const BranchInputLabel = styled('label')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.text};
  margin-bottom: ${p => p.theme.space.sm};
  gap: ${p => p.theme.space.md};
`;

const SubHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.bold};
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
  margin-top: ${p => p.theme.space.md};
`;

const StyledTextArea = styled(TextArea)`
  width: 100%;
  resize: vertical;
  min-height: 80px;
`;

const ClearButton = styled(Button)`
  color: ${p => p.theme.colors.gray400};

  &:hover {
    color: ${p => p.theme.colors.gray800};
  }
`;

const StyledIconExpandToggle = styled(IconExpandToggle)`
  margin-right: ${space(0.5)};
`;

const RepoInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(1)};
`;
const AddOverrideButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const BranchOverridesList = styled('div')`
  display: flex;
  flex-direction: column;
  margin-top: ${p => p.theme.space.md};
`;

const BranchOverrideItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding-top: ${p => p.theme.space.md};
  padding-bottom: ${p => p.theme.space.md};
`;

const BranchOverrideFields = styled('div')`
  display: flex;
  flex: 1;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const OverrideInputGroup = styled(InputGroup)`
  flex: 1;
  min-width: 0;
`;
