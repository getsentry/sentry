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

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const user = useUser();
  const hasPageFrame = useHasPageFrameFeature();

  const {mutate: updateGroupSearchView} = useUpdateGroupSearchView();

  const handleOnSave = (title: string) => {
    if (title !== view.name) {
      updateGroupSearchView(
        {
          name: title,
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
    }
    requestAnimationFrame(() => {
      setIsEditing(false);
    });
  };

  const handleBeginEditing = () => {
    setIsEditing(true);
  };

  if (hasPageFrame) {
    return (
      <TopBar.Slot name="title">
        {isEditing ? (
          <EditingViewTitle
            initialTitle={view.name}
            onSave={handleOnSave}
            stopEditing={() => setIsEditing(false)}
          />
        ) : (
          <PageFrameViewTitleWrapper>
            <ViewTitle onDoubleClick={handleBeginEditing}>{view.name}</ViewTitle>
            <Button
              icon={<IconEdit />}
              onClick={handleBeginEditing}
              aria-label={t('Edit view name')}
              size="sm"
              priority="transparent"
            />
          </PageFrameViewTitleWrapper>
        )}
      </TopBar.Slot>
    );
  }

  return isEditing ? (
    <EditingViewTitle
      initialTitle={view.name}
      onSave={handleOnSave}
      stopEditing={() => {
        setIsEditing(false);
      }}
    />
  ) : (
    <ViewTitleWrapper>
      <ViewTitle onDoubleClick={handleBeginEditing}>{view.name}</ViewTitle>
      <Button
        icon={<IconEdit />}
        onClick={handleBeginEditing}
        aria-label={t('Edit view name')}
        size="sm"
        priority="transparent"
      />
    </ViewTitleWrapper>
  );
}

function EditingViewTitle({
  initialTitle,
  onSave,
  stopEditing,
}: {
  initialTitle: string;
  onSave: (title: string) => void;
  stopEditing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const hasPageFrame = useHasPageFrameFeature();

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        onSave(title);
        break;
      case 'Escape':
        stopEditing();
        break;
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const autosizeInputRef = useAutosizeInput({
    value: title,
  });

  const GrowingInput = hasPageFrame ? PageFrameGrowingInput : StyledGrowingInput;

  return (
    <GrowingInput
      value={title}
      ref={mergeRefs(inputRef, autosizeInputRef)}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={() => stopEditing()}
      maxLength={128}
    />
  );
}

type PageFrameEditableViewTitleProps = {
  ariaLabel: string;
  maxLength: number;
  onSave: (title: string) => void;
  value: string;
  dataTestId?: string;
  errorMessage?: React.ReactNode;
  isDisabled?: boolean;
};

export function PageFrameEditableViewTitle({
  ariaLabel,
  dataTestId,
  errorMessage,
  isDisabled = false,
  maxLength,
  onSave,
  value,
}: PageFrameEditableViewTitleProps) {
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
    setIsEditing(false);
  }, [value]);

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
    if (!currentDraft.trim()) {
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
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
    <PageFrameEditableViewTitleWrapper data-test-id={dataTestId}>
      {isEditing ? (
        <PageFrameEditableInputWrapper data-test-id="editable-text-input">
          <PageFrameGrowingInput
            value={currentDraft}
            ref={mergeRefs(inputRef, autosizeInputRef)}
            onChange={event => setDraftValue(event.target.value)}
            onBlur={handleSave}
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
          />
        </PageFrameEditableInputWrapper>
      ) : (
        <PageFrameEditableLabel
          data-test-id="editable-text-label"
          isDisabled={isDisabled}
          onClick={handleBeginEditing}
          title={currentValue}
        >
          {currentValue}
        </PageFrameEditableLabel>
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
    </PageFrameEditableViewTitleWrapper>
  );
}

const PageFrameViewTitleWrapper = styled('div')`
  display: flex;
  align-items: center;

  > div {
    height: auto;
    border-bottom: none;
  }

  :not(:hover, :focus-within) {
    button {
      opacity: 0;
    }

    div {
      border-bottom-color: transparent;
    }
  }
`;

const ViewTitleWrapper = styled(Layout.Title)`
  display: flex;
  align-items: center;
  width: min-content;

  :not(:hover, :focus-within) {
    button {
      opacity: 0;
    }

    div {
      border-bottom-color: transparent;
    }
  }
`;

const ViewTitle = styled('div')`
  height: 40px;
  letter-spacing: normal;
  margin-right: ${p => p.theme.space['2xs']};
  font-size: inherit;
  align-items: center;
  border-bottom: 1px dotted ${p => p.theme.tokens.border.primary};

  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledGrowingInput = styled(Input)`
  position: relative;
  border: none;
  margin: 0;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 40px;
  border-radius: 0px;
  text-overflow: ellipsis;
  cursor: text;

  /* <Layout.Title /> styles */
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 40px;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const PageFrameGrowingInput = styled(StyledGrowingInput)`
  height: auto;
  line-height: inherit;
  font-size: inherit;
  font-weight: inherit;
`;

const PageFrameEditableViewTitleWrapper = styled(PageFrameViewTitleWrapper)`
  max-width: 100%;
`;

const PageFrameEditableLabel = styled('div')<{isDisabled: boolean}>`
  height: auto;
  letter-spacing: normal;
  margin-right: ${p => p.theme.space['2xs']};
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};

  display: block;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PageFrameEditableInputWrapper = styled('div')`
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  margin-right: ${p => p.theme.space['2xs']};
`;
