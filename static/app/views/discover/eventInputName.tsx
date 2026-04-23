import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Button} from '@sentry/scraps/button';
import {Input, useAutosizeInput} from '@sentry/scraps/input';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {EditableText} from 'sentry/components/editableText';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');
const HOMEPAGE_DEFAULT = t('New Query');

/**
 * Allows user to edit the name of the query.
 * By pressing Enter or clicking outside the component, the changes will be saved, if valid.
 */
export function EventInputName({organization, eventView, savedQuery, isHomepage}: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const hasPageFrameFeature = useHasPageFrameFeature();

  function handleChange(nextQueryName: string) {
    // Do not update automatically if
    // 1) It is a new query
    // 2) The new name is same as the old name
    if (!savedQuery || savedQuery.name === nextQueryName) {
      return;
    }

    // This ensures that we are updating SavedQuery.name only.
    // Changes on QueryBuilder table will not be saved.
    const nextEventView = EventView.fromSavedQuery({
      ...savedQuery,
      name: nextQueryName,
    });

    handleUpdateQueryName(api, organization, nextEventView).then(
      (_updatedQuery: SavedQuery) => {
        // The current eventview may have changes that are not explicitly saved.
        // So, we just preserve them and change its name
        const renamedEventView = eventView.clone();
        renamedEventView.name = nextQueryName;

        navigate(normalizeUrl(renamedEventView.getResultsViewUrlTarget(organization)));
      }
    );
  }

  const value = isHomepage ? HOMEPAGE_DEFAULT : eventView.name || NAME_DEFAULT;

  if (hasPageFrameFeature) {
    return (
      <DiscoverPageFrameEditableName
        ariaLabel={t('Edit query name')}
        maxLength={255}
        onSave={handleChange}
        value={value}
        dataTestId={`discover2-query-name-${value}`}
        errorMessage={t('Please set a name for this query')}
        isDisabled={!eventView.id || Boolean(isHomepage)}
      />
    );
  }

  return (
    <Layout.Title data-test-id={`discover2-query-name-${value}`}>
      <EditableText
        value={value}
        onChange={handleChange}
        isDisabled={!eventView.id || isHomepage}
        errorMessage={t('Please set a name for this query')}
      />
    </Layout.Title>
  );
}

type DiscoverPageFrameEditableNameProps = {
  ariaLabel: string;
  maxLength: number;
  onSave: (title: string) => void;
  value: string;
  dataTestId?: string;
  errorMessage?: React.ReactNode;
  isDisabled?: boolean;
};

function DiscoverPageFrameEditableName({
  ariaLabel,
  dataTestId,
  errorMessage,
  isDisabled = false,
  maxLength,
  onSave,
  value,
}: DiscoverPageFrameEditableNameProps) {
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
    <PageFrameEditableNameWrapper data-test-id={dataTestId}>
      {isEditing ? (
        <PageFrameEditableInputWrapper data-test-id="editable-text-input">
          <PageFrameEditableInput
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
        <PageFrameEditableNameLabel
          data-test-id="editable-text-label"
          isDisabled={isDisabled}
          onClick={handleBeginEditing}
          title={currentValue}
        >
          {currentValue}
        </PageFrameEditableNameLabel>
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
    </PageFrameEditableNameWrapper>
  );
}

const PageFrameEditableNameWrapper = styled('div')`
  display: flex;
  align-items: center;
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

const PageFrameEditableNameLabel = styled('div')<{isDisabled: boolean}>`
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

const PageFrameEditableInput = styled(Input)`
  position: relative;
  border: none;
  margin: 0;
  padding: 0;
  background: transparent;
  min-height: 0;
  height: auto;
  border-radius: 0;
  text-overflow: ellipsis;
  cursor: text;
  line-height: inherit;
  font-size: inherit;
  font-weight: inherit;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
