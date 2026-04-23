import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Button} from '@sentry/scraps/button';
import {Input, useAutosizeInput} from '@sentry/scraps/input';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type EditableViewTitleProps = {
  ariaLabel: string;
  maxLength: number;
  onSave: (title: string) => void;
  value: string;
  compact?: boolean;
  containerTestIdPrefix?: string;
  errorMessage?: React.ReactNode;
  inputTestId?: string;
  isDisabled?: boolean;
  labelTestId?: string;
  saveOnBlur?: boolean;
  startEditingOnClick?: boolean;
};

export function EditableViewTitle({
  ariaLabel,
  maxLength,
  onSave,
  value,
  compact = false,
  containerTestIdPrefix,
  errorMessage,
  inputTestId = 'editable-text-input',
  isDisabled = false,
  labelTestId = 'editable-text-label',
  saveOnBlur = false,
  startEditingOnClick = false,
}: EditableViewTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef(value);
  const currentValue = optimisticValue ?? value;
  const currentDraft = draftValue ?? currentValue;

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }

    previousValueRef.current = value;
    setOptimisticValue(null);
    setDraftValue(null);

    if (isEditing) {
      setIsEditing(false);
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const autosizeInputRef = useAutosizeInput({
    value: currentDraft,
  });

  const handleBeginEditing = () => {
    if (isDisabled) {
      return;
    }

    setDraftValue(currentValue);
    setIsEditing(true);
  };

  const stopEditing = () => {
    setDraftValue(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!currentDraft.trim() && errorMessage) {
      addErrorMessage(errorMessage);
      return;
    }

    if (currentDraft !== currentValue) {
      onSave(currentDraft);
      setOptimisticValue(currentDraft);
    }

    setDraftValue(null);
    setIsEditing(false);
  };

  return (
    <ViewTitleWrapper
      data-test-id={
        containerTestIdPrefix ? `${containerTestIdPrefix}-${currentValue}` : undefined
      }
      isCompact={compact}
    >
      {isEditing ? (
        <InputWrapper data-test-id={inputTestId}>
          <GrowingInput
            value={currentDraft}
            ref={mergeRefs(inputRef, autosizeInputRef)}
            onChange={event => setDraftValue(event.target.value)}
            onBlur={saveOnBlur ? handleSave : stopEditing}
            onKeyDown={event => {
              switch (event.key) {
                case 'Enter':
                  event.preventDefault();
                  handleSave();
                  break;
                case 'Escape':
                  event.preventDefault();
                  stopEditing();
                  break;
                default:
                  break;
              }
            }}
            maxLength={maxLength}
            isCompact={compact}
          />
        </InputWrapper>
      ) : (
        <ViewTitle
          data-test-id={labelTestId}
          isCompact={compact}
          isDisabled={isDisabled}
          onClick={startEditingOnClick ? handleBeginEditing : undefined}
          onDoubleClick={handleBeginEditing}
          title={currentValue}
        >
          {currentValue}
        </ViewTitle>
      )}
      {isDisabled ? null : (
        <Button
          icon={<IconEdit />}
          onClick={isEditing ? undefined : handleBeginEditing}
          aria-label={ariaLabel}
          aria-hidden={isEditing}
          size="sm"
          priority="transparent"
          tabIndex={isEditing ? -1 : undefined}
          style={isEditing ? {visibility: 'hidden'} : undefined}
        />
      )}
    </ViewTitleWrapper>
  );
}

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();
  const user = useUser();
  const hasPageFrame = useHasPageFrameFeature();

  const {mutate: updateGroupSearchView} = useUpdateGroupSearchView();

  const title = (
    <EditableViewTitle
      ariaLabel={t('Edit view name')}
      maxLength={128}
      onSave={nextTitle => {
        if (nextTitle === view.name) {
          return;
        }

        updateGroupSearchView(
          {
            name: nextTitle,
            id: view.id,
            projects: view.projects,
            query: view.query,
            querySort: view.querySort,
            timeFilters: view.timeFilters,
            environments: view.environments,
            optimistic: true,
          },
          {
            onSuccess: () => {
              trackAnalytics('issue_views.edit_name', {
                organization,
                ownership: user?.id === view.createdBy?.id ? 'personal' : 'organization',
                surface: 'issue-view-details',
              });
            },
          }
        );
      }}
      value={view.name}
      compact={hasPageFrame}
    />
  );

  if (hasPageFrame) {
    return <TopBar.Slot name="title">{title}</TopBar.Slot>;
  }

  return <Layout.Title>{title}</Layout.Title>;
}

const ViewTitleWrapper = styled('div')<{isCompact: boolean}>`
  display: flex;
  align-items: center;
  width: ${p => (p.isCompact ? 'auto' : 'min-content')};
  max-width: 100%;

  :not(:hover, :focus-within) {
    button {
      opacity: 0;
    }

    div {
      border-bottom-color: transparent;
    }
  }
`;

const ViewTitle = styled('div')<{isCompact: boolean; isDisabled: boolean}>`
  height: ${p => (p.isCompact ? 'auto' : '40px')};
  letter-spacing: normal;
  margin-right: ${p => p.theme.space['2xs']};
  font-size: inherit;
  font-weight: inherit;
  line-height: ${p => (p.isCompact ? 'inherit' : '40px')};
  align-items: center;
  border-bottom: ${p =>
    p.isCompact ? 'none' : `1px dotted ${p.theme.tokens.border.primary}`};
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};

  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InputWrapper = styled('div')`
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  margin-right: ${p => p.theme.space['2xs']};
`;

const GrowingInput = styled(Input)<{isCompact: boolean}>`
  position: relative;
  border: none;
  margin: 0;
  padding: 0;
  background: transparent;
  min-height: 0;
  height: ${p => (p.isCompact ? 'auto' : '40px')};
  border-radius: 0;
  text-overflow: ellipsis;
  cursor: text;
  font-size: inherit;
  font-weight: inherit;
  line-height: ${p => (p.isCompact ? 'inherit' : '40px')};

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
