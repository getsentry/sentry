import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Button} from '@sentry/scraps/button';
import {Input, useAutosizeInput} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconClose, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const user = useUser();

  const updateGroupSearchViewMutation = useUpdateGroupSearchView();

  const handleOnSave = (title: string) => {
    const oldName = view.name;
    if (title === oldName) {
      setIsEditing(false);
    } else {
      updateGroupSearchViewMutation.mutate(
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
            addSuccessMessage(
              tct('Renamed view from [oldName] to [newName]', {
                oldName,
                newName: title,
              })
            );
            setIsEditing(false);
          },
        }
      );
    }
  };

  const handleBeginEditing = () => {
    setIsEditing(true);
  };

  return isEditing ? (
    <EditingViewTitle
      initialTitle={view.name}
      onSave={handleOnSave}
      stopEditing={() => {
        setIsEditing(false);
      }}
      isPending={updateGroupSearchViewMutation.isPending}
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
  isPending,
}: {
  initialTitle: string;
  isPending: boolean;
  onSave: (title: string) => void;
  stopEditing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleSave = () => {
    if (title.trim()) {
      onSave(title.trim());
    }
  };

  const handleCancel = () => {
    stopEditing();
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleSave();
        break;
      case 'Escape':
        e.preventDefault();
        handleCancel();
        break;
      default:
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

  return (
    <EditingContainer>
      <StyledGrowingInput
        value={title}
        ref={mergeRefs(inputRef, autosizeInputRef)}
        onChange={handleOnChange}
        onKeyDown={handleOnKeyDown}
        maxLength={128}
        disabled={isPending}
      />
      <ButtonGroup gap="xs">
        <Button
          size="xs"
          onClick={handleCancel}
          disabled={isPending}
          icon={<IconClose />}
          aria-label={t('Cancel')}
        >
          {t('Cancel')}
        </Button>
        <Button
          size="xs"
          priority="primary"
          onClick={handleSave}
          busy={isPending}
          disabled={!title.trim() || isPending}
          aria-label={t('Save')}
        >
          {t('Save')}
        </Button>
      </ButtonGroup>
    </EditingContainer>
  );
}

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

const EditingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  align-items: flex-start;
`;

const ButtonGroup = styled(Flex)`
  margin-top: ${p => p.theme.space.xs};
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
