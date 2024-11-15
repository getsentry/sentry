import {Fragment, memo, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconChevron, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import useOrganization from 'sentry/utils/useOrganization';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';

interface ProjectItem {
  count: number;
  initialSampleRate: string;
  ownCount: number;
  project: Project;
  sampleRate: string;
  subProjects: SubProject[];
  error?: string;
}

interface Props extends Omit<React.ComponentProps<typeof StyledPanelTable>, 'headers'> {
  items: ProjectItem[];
  rateHeader: React.ReactNode;
  canEdit?: boolean;
  inactiveItems?: ProjectItem[];
  inputTooltip?: string;
  onChange?: (projectId: string, value: string) => void;
}

const COLUMN_COUNT = 4;

export function ProjectsTable({
  items,
  inactiveItems = [],
  inputTooltip,
  canEdit,
  rateHeader,
  onChange,
  ...props
}: Props) {
  const [tableSort, setTableSort] = useState<'asc' | 'desc'>('desc');

  const handleTableSort = useCallback(() => {
    setTableSort(value => (value === 'asc' ? 'desc' : 'asc'));
  }, []);

  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveItems = items.length > 0;
  const mainItems = hasActiveItems ? items : inactiveItems;

  return (
    <StyledPanelTable
      {...props}
      isEmpty={!items.length && !inactiveItems.length}
      headers={[
        t('Project'),
        <SortableHeader type="button" key="spans" onClick={handleTableSort}>
          {t('Sent Spans')}
          <IconArrow direction={tableSort === 'desc' ? 'down' : 'up'} size="xs" />
        </SortableHeader>,
        t('Stored Spans'),
        rateHeader,
      ]}
    >
      {mainItems
        .toSorted((a, b) => {
          if (a.count === b.count) {
            return a.project.slug.localeCompare(b.project.slug);
          }
          if (tableSort === 'asc') {
            return a.count - b.count;
          }
          return b.count - a.count;
        })
        .map(item => (
          <TableRow
            key={item.project.id}
            canEdit={canEdit}
            onChange={onChange}
            inputTooltip={inputTooltip}
            {...item}
          />
        ))}
      {hasActiveItems && inactiveItems.length > 0 && (
        <SectionHeader
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          title={
            inactiveItems.length > 1
              ? t(`+%d Inactive Projects`, inactiveItems.length)
              : t(`+1 Inactive Project`)
          }
        />
      )}
      {hasActiveItems &&
        isExpanded &&
        inactiveItems
          .toSorted((a, b) => a.project.slug.localeCompare(b.project.slug))
          .map(item => (
            <TableRow
              key={item.project.id}
              canEdit={canEdit}
              onChange={onChange}
              {...item}
            />
          ))}
    </StyledPanelTable>
  );
}

interface SubProject {
  count: number;
  slug: string;
}

function SectionHeader({
  isExpanded,
  setIsExpanded,
  title,
}: {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  title: React.ReactNode;
}) {
  return (
    <Fragment>
      <SectionHeaderCell
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(value => !value)}
        aria-label={
          isExpanded ? t('Collapse inactive projects') : t('Expand inactive projects')
        }
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(value => !value);
          }
        }}
      >
        <StyledIconChevron direction={isExpanded ? 'down' : 'right'} />
        {title}
      </SectionHeaderCell>
      {/* As the main element spans COLUMN_COUNT grid colums we need to ensure that nth child css selectors of other elements
        remain functional by adding hidden elements */}
      {Array.from({length: COLUMN_COUNT - 1}).map((_, i) => (
        <div key={i} style={{display: 'none'}} />
      ))}
    </Fragment>
  );
}

function getSubProjectContent(
  ownSlug: string,
  subProjects: SubProject[],
  isExpanded: boolean
) {
  let subProjectContent: React.ReactNode = t('No distributed traces');
  if (subProjects.length > 0) {
    const truncatedSubProjects = subProjects.slice(0, MAX_PROJECTS_COLLAPSED);
    const overflowCount = subProjects.length - MAX_PROJECTS_COLLAPSED;
    const moreTranslation = t('+%d more', overflowCount);
    const stringifiedSubProjects =
      overflowCount > 0
        ? `${truncatedSubProjects.map(p => p.slug).join(', ')}, ${moreTranslation}`
        : oxfordizeArray(truncatedSubProjects.map(p => p.slug));

    subProjectContent = isExpanded ? (
      <Fragment>
        <div>{ownSlug}</div>
        {subProjects.map(subProject => (
          <div key={subProject.slug}>{subProject.slug}</div>
        ))}
      </Fragment>
    ) : (
      t('Including spans in ') + stringifiedSubProjects
    );
  }

  return subProjectContent;
}

function getSubSpansContent(
  ownCount: number,
  subProjects: SubProject[],
  isExpanded: boolean
) {
  let subSpansContent: React.ReactNode = '';
  if (subProjects.length > 0) {
    const subProjectSum = subProjects.reduce(
      (acc, subProject) => acc + subProject.count,
      0
    );

    subSpansContent = isExpanded ? (
      <Fragment>
        <div>{formatAbbreviatedNumber(ownCount, 2)}</div>
        {subProjects.map(subProject => (
          <div key={subProject.slug}>{formatAbbreviatedNumber(subProject.count)}</div>
        ))}
      </Fragment>
    ) : (
      formatAbbreviatedNumber(subProjectSum)
    );
  }

  return subSpansContent;
}

function getStoredSpansContent(
  ownCount: number,
  subProjects: SubProject[],
  sampleRate: number,
  isExpanded: boolean
) {
  let subSpansContent: React.ReactNode = '';
  if (subProjects.length > 0) {
    const subProjectSum = subProjects.reduce(
      (acc, subProject) => acc + Math.floor(subProject.count * sampleRate),
      0
    );

    subSpansContent = isExpanded ? (
      <Fragment>
        <div>{formatAbbreviatedNumber(Math.floor(ownCount * sampleRate), 2)}</div>
        {subProjects.map(subProject => (
          <div key={subProject.slug}>
            {formatAbbreviatedNumber(Math.floor(subProject.count * sampleRate))}
          </div>
        ))}
      </Fragment>
    ) : (
      formatAbbreviatedNumber(subProjectSum)
    );
  }

  return subSpansContent;
}

const MAX_PROJECTS_COLLAPSED = 3;
const TableRow = memo(function TableRow({
  project,
  canEdit,
  count,
  ownCount,
  sampleRate,
  initialSampleRate,
  subProjects,
  error,
  inputTooltip,
  onChange,
}: {
  count: number;
  initialSampleRate: string;
  ownCount: number;
  project: Project;
  sampleRate: string;
  subProjects: SubProject[];
  canEdit?: boolean;
  error?: string;
  inputTooltip?: string;
  onChange?: (projectId: string, value: string) => void;
}) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);

  const isExpandable = subProjects.length > 0;
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const subProjectContent = getSubProjectContent(project.slug, subProjects, isExpanded);
  const subSpansContent = getSubSpansContent(ownCount, subProjects, isExpanded);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(project.id, event.target.value);
    },
    [onChange, project.id]
  );

  const storedSpans = Math.floor(count * parsePercent(sampleRate));
  return (
    <Fragment key={project.slug}>
      <Cell>
        <FirstCellLine data-has-chevron={isExpandable}>
          <HiddenButton
            type="button"
            disabled={!isExpandable}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            onClick={() => setIsExpanded(value => !value)}
          >
            {isExpandable && (
              <StyledIconChevron direction={isExpanded ? 'down' : 'right'} />
            )}
            <ProjectBadge project={project} disableLink avatarSize={16} />
          </HiddenButton>
          {hasAccess && (
            <SettingsButton
              title={t('Open Project Settings')}
              aria-label={t('Open Project Settings')}
              size="xs"
              priority="link"
              icon={<IconSettings />}
              to={`/organizations/${organization.slug}/settings/projects/${project.slug}/performance`}
            />
          )}
        </FirstCellLine>
        <SubProjects data-is-first-column>{subProjectContent}</SubProjects>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">{formatAbbreviatedNumber(count)}</FirstCellLine>
        <SubContent>{subSpansContent}</SubContent>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">
          {formatAbbreviatedNumber(storedSpans)}
        </FirstCellLine>
        <SubContent data-is-last-column>
          {getStoredSpansContent(
            ownCount,
            subProjects,
            parsePercent(sampleRate),
            isExpanded
          )}
        </SubContent>
      </Cell>
      <Cell>
        <FirstCellLine>
          <Tooltip disabled={!inputTooltip} title={inputTooltip}>
            <PercentInput
              type="number"
              disabled={!canEdit}
              onChange={handleChange}
              size="sm"
              value={sampleRate}
            />
          </Tooltip>
        </FirstCellLine>
        {error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : sampleRate !== initialSampleRate ? (
          <SmallPrint>{t('previous: %s%%', initialSampleRate)}</SmallPrint>
        ) : null}
      </Cell>
    </Fragment>
  );
});

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(${COLUMN_COUNT - 1}, max-content);
`;

const SmallPrint = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  line-height: 1.5;
  text-align: right;
`;

const ErrorMessage = styled('span')`
  color: ${p => p.theme.error};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 1.5;
  text-align: right;
`;

const SortableHeader = styled('button')`
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  text-transform: inherit;
  align-items: center;
  gap: ${space(0.5)};
`;

const Cell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

const SectionHeaderCell = styled('div')`
  display: flex;
  grid-column: span ${COLUMN_COUNT};
  padding: ${space(1.5)};
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  cursor: pointer;
`;

const FirstCellLine = styled('div')`
  display: flex;
  align-items: center;
  height: 32px;
  & > * {
    flex-shrink: 0;
  }
  &[data-align='right'] {
    justify-content: flex-end;
  }
  &[data-has-chevron='false'] {
    padding-left: ${space(2)};
  }
`;

const SubContent = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: right;

  & > div {
    line-height: 2;
    margin-left: -${space(2)};
    padding-left: ${space(2)};
    margin-right: -${space(2)};
    padding-right: ${space(2)};
    &:nth-child(odd) {
      background: ${p => p.theme.backgroundSecondary};
    }
  }

  &[data-is-first-column] > div {
    margin-left: -${space(1)};
    padding-left: ${space(1)};
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }

  &[data-is-last-column] > div {
    margin-right: -${space(1)};
    padding-right: ${space(1)};
    border-top-right-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const SubProjects = styled(SubContent)`
  text-align: left;
  margin-left: ${space(2)};
`;

const HiddenButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;

  /* Overwrite the platform icon's cursor style */
  &:not([disabled]) img {
    cursor: pointer;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  height: 12px;
  width: 12px;
  margin-right: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const SettingsButton = styled(LinkButton)`
  margin-left: ${space(0.5)};
  color: ${p => p.theme.subText};
  visibility: hidden;

  &:focus {
    visibility: visible;
  }
  ${Cell}:hover & {
    visibility: visible;
  }
`;
