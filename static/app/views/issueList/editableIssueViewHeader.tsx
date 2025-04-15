import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {GrowingInput} from 'sentry/components/growingInput';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();
  const [isEditing, setIsEditing] = useState(false);

  const {mutate: updateGroupSearchView} = useUpdateGroupSearchView({
    onSuccess: () => {
      trackAnalytics('issue_views.renamed_view', {
        leftNav: true,
        organization: organization.slug,
      });
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const handleOnSave = (title: string) => {
    if (title !== view.name) {
      updateGroupSearchView({
        name: title,
        id: view.id,
        projects: view.projects,
        query: view.query,
        querySort: view.querySort,
        timeFilters: view.timeFilters,
        environments: view.environments,
        optimisticlyUpdate: true,
      });
    }
    requestAnimationFrame(() => {
      setIsEditing(false);
    });
  };

  const handleBeginEditing = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    setIsEditing(true);
  };

  return isEditing ? (
    <EditingViewTitle
      initialTitle={view.name}
      onSave={handleOnSave}
      inputRef={inputRef}
      stopEditing={() => {
        setTimeout(() => {
          inputRef.current?.blur();
          setIsEditing(false);
        });
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
  inputRef,
  stopEditing,
}: {
  initialTitle: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSave: (title: string) => void;
  stopEditing: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(title);
      stopEditing();
    }
  };

  const handleOnBlur = () => {
    inputRef.current?.blur();
    setTitle(initialTitle);
    stopEditing();
  };

  return (
    <StyledGrowingInput
      value={title}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={handleOnBlur}
      ref={inputRef}
      maxLength={128}
    />
  );
}

const ViewTitleWrapper = styled('div')`
  display: flex;
  align-items: center;

  :not(:hover, :focus-within) {
    button {
      visibility: hidden;
    }

    div {
      border-bottom-color: transparent;
    }
  }
`;

const ViewTitle = styled('div')`
  height: 40px;
  white-space: nowrap;
  letter-spacing: normal;
  margin-right: ${space(0.25)};
  font-size: inherit;
  display: flex;
  align-items: center;
  border-bottom: 1px dotted ${p => p.theme.border};
`;

const StyledGrowingInput = styled(GrowingInput)`
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
  font-size: inherit;
  line-height: inherit;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
