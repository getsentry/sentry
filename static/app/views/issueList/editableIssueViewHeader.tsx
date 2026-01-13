import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {useAutosizeInput} from 'sentry/components/core/input/useAutosizeInput';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const user = useUser();

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
        borderless
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
    <StyledGrowingInput
      value={title}
      ref={mergeRefs(inputRef, autosizeInputRef)}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={() => stopEditing()}
      maxLength={128}
    />
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
  margin-right: ${space(0.25)};
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
