import React, {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import DropdownButton from 'sentry/components/dropdownButton';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {
  IconCheckmark,
  IconClose,
  IconGithub,
  IconGrabbable,
  IconSync,
} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeCodeChangesPathname} from 'sentry/views/explore/codeChanges/pathnames';

// Styled components used in mock data
const OptionLabel = styled('span')`
  white-space: normal;
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

const branchOptions = [
  {
    value: 'main',
    label: <OptionLabel>Main branch</OptionLabel>,
    textValue: 'Main branch',
  },
  {
    value: 'develop',
    label: <OptionLabel>Develop</OptionLabel>,
    textValue: 'Develop',
  },
  {
    value: 'feature/new-ui',
    label: <OptionLabel>Feature/new-ui</OptionLabel>,
    textValue: 'Feature/new-ui',
  },
];

const uploadFilterOptions = [
  {
    label: 'Code Coverage',
    options: [
      {value: 'coverage-all', label: 'All uploads'},
      {value: 'coverage-completed', label: 'Completed'},
      {value: 'coverage-pending', label: 'Pending'},
      {value: 'coverage-error', label: 'Error'},
    ],
  },
  {
    label: 'Build Size',
    options: [
      {value: 'buildsize-all', label: 'All uploads'},
      {value: 'buildsize-completed', label: 'Completed'},
      {value: 'buildsize-pending', label: 'Pending'},
      {value: 'buildsize-error', label: 'Error'},
    ],
  },
];

// Mock commits data
const commitsData = [
  {
    id: '1',
    message: 'step4: add smiles',
    author: 'Flamefire',
    hash: 'd677638',
    timestamp: '1 day ago',
    coverage: '68.50%',
    uploadCount: {
      total: 81,
      processed: 65,
      pending: 15,
      failed: 1,
    },
    authorUser: {
      id: '1',
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/1234567?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '2',
    message: 'step3: add Codecov badge',
    author: 'Maya Rodriguez',
    hash: '3d59704',
    timestamp: '2 days ago',
    coverage: '65%',
    uploadCount: {
      total: 80,
      processed: 80,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '2',
      email: 'maya.rodriguez@example.com',
      name: 'Maya Rodriguez',
      username: 'mayarod',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/87772943?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '3',
    message: 'step3: add Codecov badge',
    author: 'Alex Chen',
    hash: '4663d65',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 78,
      processed: 78,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '3',
      email: 'alex.chen@example.com',
      name: 'Alex Chen',
      username: 'alexchen',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/88201630?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '4',
    message: 'step3: cover divide by 0 case',
    author: 'Sarah Johnson',
    hash: 'f0a9d69',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 78,
      processed: 78,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '4',
      email: 'sarah.johnson@example.com',
      name: 'Sarah Johnson',
      username: 'sarahj',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/71270647?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '5',
    message: 'step3: cover divide by 0 case',
    author: 'David Kim',
    hash: '3c01a7b',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 36,
      processed: 36,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '5',
      email: 'david.kim@example.com',
      name: 'David Kim',
      username: 'dkim',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/159853603?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '6',
    message: 'step3: add project status check target',
    author: 'Emma Thompson',
    hash: 'ee98986',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 66,
      processed: 66,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '6',
      email: 'emma.thompson@example.com',
      name: 'Emma Thompson',
      username: 'emmathompson',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/3456789?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '7',
    message: 'step3: add project status check target',
    author: 'Marcus Johnson',
    hash: 'a09f75c',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 77,
      processed: 77,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '7',
      email: 'marcus.johnson@example.com',
      name: 'Marcus Johnson',
      username: 'marcusj',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/6789012?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '8',
    message: 'step2: upload coverage reports to Codecov',
    author: 'Priya Patel',
    hash: '366e107',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 88,
      processed: 88,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '8',
      email: 'priya.patel@example.com',
      name: 'Priya Patel',
      username: 'priyap',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/8901234?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '9',
    message: 'step2: upload coverage reports to Codecov',
    author: 'Jake Wilson',
    hash: '79d45ad',
    timestamp: '3 days ago',
    coverage: '100%',
    uploadCount: {
      total: 55,
      processed: 55,
      pending: 0,
      failed: 0,
    },
    authorUser: {
      id: '9',
      email: 'jake.wilson@example.com',
      name: 'Jake Wilson',
      username: 'jakew',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/5678901?v=4',
        avatarType: 'gravatar' as const,
        avatarUuid: null,
      },
    },
  },
];

const COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'commit', name: t('Commits'), width: COL_WIDTH_UNDEFINED},
  {key: 'uploads', name: t('Upload count'), width: COL_WIDTH_UNDEFINED},
  {key: 'coverage', name: t('Patch coverage'), width: COL_WIDTH_UNDEFINED},
];

interface MultiSelectDropdownProps {
  onChange: (values: string[]) => void;
  options: Array<{label: string; options: Array<{label: string; value: string}>}>;
  selectedValues: string[];
}

function MultiSelectDropdown({
  selectedValues,
  options,
  onChange,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [orderedOptions, setOrderedOptions] = useState(options);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Flatten options for easier access
  const flatOptions = orderedOptions.flatMap(section => section.options);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOption = (value: string) => {
    const categoryPrefix = value.split('-')[0] ?? ''; // 'coverage' or 'buildsize'
    const allValue = `${categoryPrefix}-all`;

    if (value === allValue) {
      // If category's "All uploads" is selected, clear other selections in that category
      const otherCategoryValues = selectedValues.filter(
        v => !v.startsWith(categoryPrefix)
      );
      onChange([...otherCategoryValues, allValue]);
    } else {
      // Remove category's "all" if it was selected and add the new option
      const newValues = selectedValues.filter(v => v !== allValue);
      if (selectedValues.includes(value)) {
        // Remove if already selected
        const filtered = newValues.filter(v => v !== value);
        // Check if this was the last selection in the category
        const hasOtherCategorySelections = filtered.some(v =>
          v.startsWith(categoryPrefix)
        );
        onChange(
          hasOtherCategorySelections
            ? filtered
            : [...filtered.filter(v => !v.startsWith(categoryPrefix)), allValue]
        );
      } else {
        // Add if not selected
        onChange([...newValues, value]);
      }
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return 'All uploads';
    }

    // Count selections per category
    const coverageSelections = selectedValues.filter(v => v.startsWith('coverage-'));
    const buildsizeSelections = selectedValues.filter(v => v.startsWith('buildsize-'));

    const parts: string[] = [];

    if (coverageSelections.length === 1) {
      const option = flatOptions.find(opt => opt.value === coverageSelections[0]);
      if (option?.value.endsWith('-all')) {
        parts.push('Coverage: All');
      } else {
        parts.push(`Coverage: ${option?.label}`);
      }
    } else if (coverageSelections.length > 1) {
      parts.push(`Coverage: ${coverageSelections.length}`);
    }

    if (buildsizeSelections.length === 1) {
      const option = flatOptions.find(opt => opt.value === buildsizeSelections[0]);
      if (option?.value.endsWith('-all')) {
        parts.push('Build Size: All');
      } else {
        parts.push(`Build Size: ${option?.label}`);
      }
    } else if (buildsizeSelections.length > 1) {
      parts.push(`Build Size: ${buildsizeSelections.length}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'All uploads';
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    const newOptions = [...orderedOptions];
    const draggedItem = newOptions[draggedIndex];

    if (!draggedItem) {
      return;
    }

    newOptions.splice(draggedIndex, 1);
    newOptions.splice(index, 0, draggedItem);

    setOrderedOptions(newOptions);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <CustomDropdownContainer ref={dropdownRef}>
      <DropdownButton
        isOpen={isOpen}
        data-test-id="page-filter-upload-selector"
        onMouseDown={() => setIsOpen(!isOpen)}
      >
        <TriggerLabelWrap>
          <TriggerLabel>{getDisplayText()}</TriggerLabel>
        </TriggerLabelWrap>
      </DropdownButton>

      {isOpen && (
        <DropdownMenuContent>
          {orderedOptions.map((section, index) => (
            <Fragment key={section.label}>
              <DropdownSectionHeader
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                $isDragging={draggedIndex === index}
              >
                <Flex gap="sm" align="center">
                  <IconGrabbable size="xs" />
                  <span>{section.label}</span>
                </Flex>
              </DropdownSectionHeader>
              {section.options.map(option => {
                const categoryPrefix = option.value.split('-')[0] ?? '';
                const allValue = `${categoryPrefix}-all`;
                return (
                  <DropdownItem
                    key={option.value}
                    onClick={() => handleToggleOption(option.value)}
                  >
                    <Checkbox
                      type="checkbox"
                      checked={
                        option.value === allValue
                          ? selectedValues.includes(allValue) ||
                            !selectedValues.some(v => v.startsWith(categoryPrefix))
                          : selectedValues.includes(option.value)
                      }
                      readOnly
                    />
                    <DropdownItemText>{option.label}</DropdownItemText>
                  </DropdownItem>
                );
              })}
            </Fragment>
          ))}
        </DropdownMenuContent>
      )}
    </CustomDropdownContainer>
  );
}

function renderTableHeader(
  column: GridColumnOrder,
  sort: {field: string; order: 'asc' | 'desc'} | null,
  onSortChange: (field: string, order: 'asc' | 'desc') => void,
  location: any
) {
  const {key, name} = column;
  const alignment = key === 'coverage' || key === 'uploads' ? 'right' : 'left';

  const sortKey = String(key);
  const currentDirection = sort?.field === sortKey ? sort.order : undefined;
  const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';

  const titleWithTooltip = (
    <Fragment>
      {name}
      {key === 'uploads' && (
        <span style={{paddingLeft: '4px', paddingRight: '4px'}}>
          <QuestionTooltip
            size="xs"
            title={
              <TooltipContent>
                <TooltipSection>
                  <TooltipTitle>Uploads count</TooltipTitle>
                  <TooltipDescription>
                    This shows the total number of reports Codecov has received.
                  </TooltipDescription>
                </TooltipSection>
                <TooltipSection>
                  <TooltipTitle>{t('Processed')}</TooltipTitle>
                  <TooltipDescription>
                    {t('The number of uploads that were successfully processed.')}
                  </TooltipDescription>
                </TooltipSection>
                <TooltipSection>
                  <TooltipTitle>{t('Pending')}</TooltipTitle>
                  <TooltipDescription>
                    {t("Uploads that Sentry has received but hasn't processed yet.")}
                  </TooltipDescription>
                </TooltipSection>
                <TooltipSection>
                  <TooltipTitle>{t('Failed')}</TooltipTitle>
                  <TooltipDescription>
                    {t('Uploads that encountered errors during processing.')}
                  </TooltipDescription>
                </TooltipSection>
              </TooltipContent>
            }
            position="top"
          />
        </span>
      )}
    </Fragment>
  );

  return (
    <SortLink
      align={alignment}
      title={titleWithTooltip}
      direction={currentDirection}
      canSort
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          sort: `${nextDirection === 'desc' ? '-' : ''}${sortKey}`,
        },
      })}
      onClick={() => onSortChange(sortKey, nextDirection)}
    />
  );
}

function renderTableBody(
  column: GridColumnOrder,
  row: any,
  rowIndex: number,
  _columnIndex: number
) {
  const key = String(column.key);
  const alignment = ['coverage', 'uploads'].includes(key) ? 'right' : 'left';

  if (key === 'commit') {
    const commitCell = (
      <CommitCell>
        <UserAvatar user={row.authorUser} size={40} gravatar />
        <CommitInfo>
          <CommitMessage>{row.message}</CommitMessage>
          <CommitDetails>
            <AuthorName>{row.author}</AuthorName> committed{' '}
            <CommitHashLink
              href={`https://github.com/example-org/example-repo/commit/${row.hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGithub size="xs" />
              {row.hash}
            </CommitHashLink>{' '}
            • {row.timestamp}
          </CommitDetails>
        </CommitInfo>
      </CommitCell>
    );

    // Make the first row clickable and link to commit detail
    if (rowIndex === 0) {
      return <CommitCellLink hash={row.hash}>{commitCell}</CommitCellLink>;
    }

    return commitCell;
  }

  if (key === 'coverage') {
    return <AlignmentContainer alignment={alignment}>{row.coverage}</AlignmentContainer>;
  }

  if (key === 'uploads') {
    // Safely handle cases where uploadCount might be undefined or missing properties
    const uploadCount = row.uploadCount || {};
    const total = uploadCount.total ?? 0;
    const processed = uploadCount.processed ?? 0;
    const pending = uploadCount.pending ?? 0;
    const failed = uploadCount.failed ?? 0;

    return (
      <UploadCountCell>
        <UploadBreakdown>
          <UploadStatus>
            <StatusDotLegacy $color="success">
              <IconCheckmark />
            </StatusDotLegacy>
            <UploadText>
              {processed} {t('Processed')}
            </UploadText>
          </UploadStatus>
          {pending > 0 && (
            <UploadStatus>
              <StatusDotLegacy $color="warning">
                <IconSync />
              </StatusDotLegacy>
              <UploadText>
                {pending} {t('Pending')}
              </UploadText>
            </UploadStatus>
          )}
          {failed > 0 && (
            <UploadStatus>
              <StatusDotLegacy $color="error">
                <IconClose />
              </StatusDotLegacy>
              <UploadText>
                {failed} {t('Failed')}
              </UploadText>
            </UploadStatus>
          )}
        </UploadBreakdown>
        <UploadNumber>{total}</UploadNumber>
      </UploadCountCell>
    );
  }

  return <AlignmentContainer alignment={alignment}>{row[key]}</AlignmentContainer>;
}

// Component to handle the organization context for commit links
function CommitCellLink({hash, children}: {children: React.ReactNode; hash: string}) {
  const organization = useOrganization();
  const commitUrl = makeCodeChangesPathname({
    organization,
    path: `/commits/${hash}/`,
  });

  return <StyledLink to={commitUrl}>{children}</StyledLink>;
}

interface CommitsTableListProps {
  searchQuery?: string;
}

export default function CommitsTableList(_props: CommitsTableListProps) {
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedUploadFilters, setSelectedUploadFilters] = useState<string[]>([
    'completed',
    'pending',
  ]);
  const [commitsSort, setCommitsSort] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Sort handler
  const handleCommitsSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setCommitsSort({field, order});
  }, []);

  // Sort data function
  const sortData = useCallback(
    (data: any[], sort: {field: string; order: 'asc' | 'desc'} | null) => {
      if (!sort) return data;

      return [...data].sort((a, b) => {
        let aValue = a[sort.field];
        let bValue = b[sort.field];

        if (sort.field === 'commit') {
          // Sort by message for commit columns
          aValue = a.message;
          bValue = b.message;
        } else if (sort.field === 'coverage') {
          // Convert coverage percentage to number for sorting
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        } else if (sort.field === 'uploads') {
          // Sort by total upload count
          aValue = a.uploads?.processed + a.uploads?.pending + a.uploads?.failed || 0;
          bValue = b.uploads?.processed + b.uploads?.pending + b.uploads?.failed || 0;
        }

        // Handle string comparisons
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.order === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Handle numeric comparisons
        if (sort.order === 'asc') {
          return aValue - bValue;
        }
        return bValue - aValue;
      });
    },
    []
  );

  // Apply sorting to data
  const sortedCommitsData = useMemo(() => {
    return sortData(commitsData, commitsSort);
  }, [commitsSort, sortData]);

  // Pagination configuration
  const ITEMS_PER_PAGE = 5;
  const currentPage = parseInt(location.query?.page as string, 10) || 1;

  // Calculate pagination values
  const totalItems = commitsData.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageData = sortedCommitsData.slice(startIndex, endIndex);

  // Create mock pageLinks for pagination component
  const pageLinks = useMemo(() => {
    const links = [];
    if (currentPage > 1) {
      links.push(`<https://example.com?page=${currentPage - 1}>; rel="previous"`);
    }
    if (currentPage < totalPages) {
      links.push(`<https://example.com?page=${currentPage + 1}>; rel="next"`);
    }
    return links.length > 0 ? links.join(', ') : null;
  }, [currentPage, totalPages]);

  const handleCursor = useCallback(
    (
      _cursor: string | undefined,
      path: string,
      query: Record<string, any>,
      delta: number
    ) => {
      const newPage = currentPage + delta;
      if (newPage >= 1 && newPage <= totalPages) {
        navigate({
          pathname: path,
          query: {
            ...query,
            page: newPage,
          },
        });
      }
    },
    [currentPage, totalPages, navigate]
  );

  const paginationCaption = useMemo(() => {
    const start = startIndex + 1;
    const end = Math.min(endIndex, totalItems);
    return `${start}-${end} of ${totalItems}`;
  }, [startIndex, endIndex, totalItems]);

  return (
    <CommitsSection>
      <CommitsTabControls>
        <CompactSelect
          searchable
          disableSearchFilter
          searchPlaceholder={t('search by branch name')}
          menuTitle={t('Filter to branch')}
          value={selectedBranch}
          options={branchOptions}
          onChange={option => setSelectedBranch(String(option?.value))}
          closeOnSelect
          menuWidth="22em"
          trigger={(triggerProps, isOpen) => (
            <DropdownButton
              isOpen={isOpen}
              data-test-id="page-filter-branch-selector"
              {...triggerProps}
            >
              <TriggerLabelWrap>
                <Flex align="center" gap="sm">
                  <IconContainer>
                    <IconBranch />
                  </IconContainer>
                  <TriggerLabel>
                    {branchOptions.find(opt => opt.value === selectedBranch)?.textValue ||
                      t('Select branch')}
                  </TriggerLabel>
                </Flex>
              </TriggerLabelWrap>
            </DropdownButton>
          )}
        />

        <MultiSelectDropdown
          selectedValues={selectedUploadFilters}
          options={uploadFilterOptions}
          onChange={setSelectedUploadFilters}
        />
      </CommitsTabControls>
      <GridEditable
        aria-label={t('Commits Table')}
        isLoading={false}
        data={currentPageData}
        columnOrder={COLUMN_ORDER}
        columnSortBy={
          commitsSort ? [{key: commitsSort.field, order: commitsSort.order}] : []
        }
        grid={{
          renderHeadCell: (column: GridColumnOrder) =>
            renderTableHeader(column, commitsSort, handleCommitsSortChange, location),
          renderBodyCell: renderTableBody,
        }}
      />
      <StyledPagination
        caption={paginationCaption}
        pageLinks={pageLinks}
        onCursor={handleCursor}
      />
    </CommitsSection>
  );
}

// Styled Components
const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const IconContainer = styled('div')`
  flex: 1 0 14px;
  height: 14px;
`;

const CustomDropdownContainer = styled('div')`
  position: relative;
  display: inline-block;
`;

const DropdownMenuContent = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.dropdown};
  min-width: 200px;
  margin-top: ${p => p.theme.space.xs};
`;

const DropdownSectionHeader = styled('div')<{$isDragging?: boolean}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: ${p => p.theme.backgroundSecondary};
  cursor: grab;
  user-select: none;
  opacity: ${p => (p.$isDragging ? 0.5 : 1)};
  transition: opacity 0.2s ease;

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }

  &:active {
    cursor: grabbing;
  }

  &:hover {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const DropdownItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  cursor: pointer;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:first-child {
    border-radius: ${p => p.theme.space.xs} ${p => p.theme.space.xs} 0 0;
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.space.xs} ${p => p.theme.space.xs};
  }
`;

const Checkbox = styled('input')`
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: ${p => p.theme.purple400};

  &:checked {
    background-color: ${p => p.theme.purple400};
    border-color: ${p => p.theme.purple400};
  }
`;

const DropdownItemText = styled('span')`
  flex: 1;
`;

const CommitsSection = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const CommitsTabControls = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  margin-bottom: ${p => p.theme.space.md};
`;

const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

const CommitCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

const CommitInfo = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const CommitMessage = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xl};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const CommitDetails = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const AuthorName = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.subText};
`;

const CommitHashLink = styled('a')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.linkColor};
  text-decoration: none;
  font-family: ${p => p.theme.text.familyMono};
  font-weight: ${p => p.theme.fontWeight.normal};

  &:hover {
    color: ${p => p.theme.linkHoverColor};
    text-decoration: underline;
  }

  &:visited {
    color: ${p => p.theme.linkColor};
  }
`;

const UploadCountCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  justify-content: flex-end;
`;

const UploadNumber = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

const UploadBreakdown = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${p => p.theme.space.md};
  flex-wrap: nowrap;
`;

const UploadStatus = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  white-space: nowrap;
`;

const StatusDotLegacy = styled('div')<{$color: 'success' | 'warning' | 'error'}>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => {
    switch (p.$color) {
      case 'success':
        return `${p.theme.success}20`;
      case 'warning':
        return `${p.theme.warning}20`;
      case 'error':
        return `${p.theme.error}20`;
      default:
        return `${p.theme.gray300}20`;
    }
  }};

  svg {
    width: 10px;
    height: 10px;
    color: ${p => {
      switch (p.$color) {
        case 'success':
          return p.theme.success;
        case 'warning':
          return p.theme.warning;
        case 'error':
          return p.theme.error;
        default:
          return p.theme.gray300;
      }
    }};
  }
`;

const UploadText = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  color: ${p => p.theme.subText};
`;

const StyledLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  display: block;

  &:hover {
    color: inherit;
    text-decoration: none;
  }

  &:hover ${CommitCell} {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const TooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const TooltipSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const TooltipTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
`;

const TooltipDescription = styled('div')`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;
