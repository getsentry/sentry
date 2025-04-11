import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import {GrowingInput} from 'sentry/components/growingInput';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

type LeftNavViewsHeaderProps = {
  selectedProjectIds: number[];
};

function LeftNavViewsHeader({selectedProjectIds}: LeftNavViewsHeaderProps) {
  const {projects} = useProjects();
  const prefersStackedNav = usePrefersStackedNav();
  const organization = useOrganization();

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchView} = useSelectedGroupSearchView();

  const issuesTitleComponent = organization.features.includes('issue-view-sharing') ? (
    groupSearchView ? (
      <IssueViewEditableTitle view={groupSearchView} />
    ) : (
      t('Issues')
    )
  ) : (
    (groupSearchView?.name ?? t('Issues'))
  );

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <Layout.Title>{issuesTitleComponent}</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
    </Layout.Header>
  );
}

function IssueViewEditableTitle({view}: {view: GroupSearchView}) {
  const [inputValue, setInputValue] = useState(view.name);
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

  useEffect(() => {
    setInputValue(view.name);
  }, [view.name]);

  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement, Element>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isEditing) {
      return;
    }

    if (isEmpty) {
      setInputValue(view.name);
      setIsEditing(false);
      return;
    }

    const trimmedInputValue = inputValue.trim();
    if (trimmedInputValue !== view.name) {
      updateGroupSearchView({
        name: trimmedInputValue,
        id: view.id,
        projects: view.projects,
        query: view.query,
        querySort: view.querySort,
        timeFilters: view.timeFilters,
        environments: view.environments,
      });
      setInputValue(trimmedInputValue);
    }
    setIsEditing(false);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setInputValue(view.name.trim());
      setIsEditing(false);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else {
      inputRef.current?.blur();
    }
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return isEditing ? (
    <StyledGrowingInput
      value={inputValue}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={handleOnBlur}
      ref={inputRef}
      maxLength={128}
      onPointerDown={e => {
        e.stopPropagation();
        if (!isEditing) {
          e.preventDefault();
        }
      }}
      onMouseDown={e => {
        e.stopPropagation();
        if (!isEditing) {
          e.preventDefault();
        }
      }}
    />
  ) : (
    <UnselectedTabTitle
      onDoubleClick={() => setIsEditing(true)}
      onPointerDown={e => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onMouseDown={e => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {view.name}
      <StyledIconEdit data-edit-icon onClick={() => setIsEditing(true)} />
    </UnselectedTabTitle>
  );
}

export default LeftNavViewsHeader;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;

const UnselectedTabTitle = styled('div')`
  height: 40px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1px;
  line-height: 1.5;
  font-size: inherit;

  :not(:hover) {
    [data-edit-icon] {
      ${p => p.theme.visuallyHidden};
    }
  }
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
  line-height: 1.5;
  font-size: inherit;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const StyledIconEdit = styled(IconEdit)`
  margin-left: ${space(1)};
  cursor: pointer;
`;
