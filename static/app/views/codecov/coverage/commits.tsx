import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {IconBranch} from 'sentry/components/codecov/branchSelector/iconBranch';
import {IconIntegratedOrg} from 'sentry/components/codecov/integratedOrgSelector/iconIntegratedOrg';
import {IconRepository} from 'sentry/components/codecov/repoSelector/iconRepository';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {IconGithub, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeCodecovPathname} from 'sentry/views/codecov/pathnames';

// Mock data for demonstration - replace with actual data
const organizationOptions = [
  {value: 'turing-corp', label: 'Turing-Corp'},
  {value: 'Example Org-1', label: 'Example Org-1'},
  {value: 'Example Org-2', label: 'Example Org-2'},
];

const repositoryOptions = [
  {value: 'enigma', label: 'enigma'},
  {value: 'example-repo-1', label: 'example-repo-1'},
  {value: 'example-repo-2', label: 'example-repo-2'},
];

const branchOptions = [
  {value: 'main', label: 'Main branch'},
  {value: 'develop', label: 'Develop'},
  {value: 'feature/new-ui', label: 'Feature/new-ui'},
];

const tabOptions = [
  {id: 'commits', label: 'Commits'},
  {id: 'pulls', label: 'Pulls'},
  {id: 'fileExplorer', label: 'File Explorer'},
];

const uploadFilterOptions = [
  {value: 'all', label: 'All uploads'},
  {value: 'completed', label: 'Completed'},
  {value: 'pending', label: 'Pending'},
  {value: 'error', label: 'Error'},
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
    },
  },
  {
    id: '2',
    message: 'step3: add Codecov badge',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '3',
    message: 'step3: add Codecov badge',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '4',
    message: 'step3: cover divide by 0 case',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '5',
    message: 'step3: cover divide by 0 case',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '6',
    message: 'step3: add project status check target',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '7',
    message: 'step3: add project status check target',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '8',
    message: 'step2: upload coverage reports to Codecov',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
  {
    id: '9',
    message: 'step2: upload coverage reports to Codecov',
    author: 'Flamefire',
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
      email: 'flamefire@example.com',
      name: 'Flamefire',
      username: 'flamefire',
      ip_address: '',
    },
  },
];

const COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'commit', name: t('Commits'), width: COL_WIDTH_UNDEFINED},
  {key: 'coverage', name: t('Patch coverage'), width: COL_WIDTH_UNDEFINED},
  {key: 'uploads', name: t('Upload count'), width: COL_WIDTH_UNDEFINED},
];

interface MultiSelectDropdownProps {
  onChange: (values: string[]) => void;
  options: Array<{label: string; value: string}>;
  selectedValues: string[];
}

function MultiSelectDropdown({
  selectedValues,
  options,
  onChange,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    if (value === 'all') {
      // If "All uploads" is selected, clear other selections
      onChange(['all']);
    } else {
      // Remove "all" if it was selected and add the new option
      const newValues = selectedValues.filter(v => v !== 'all');
      if (selectedValues.includes(value)) {
        // Remove if already selected
        const filtered = newValues.filter(v => v !== value);
        onChange(filtered.length === 0 ? ['all'] : filtered);
      } else {
        // Add if not selected
        onChange([...newValues, value]);
      }
    }
  };

  const getDisplayText = () => {
    if (selectedValues.includes('all') || selectedValues.length === 0) {
      return 'All uploads';
    }
    if (selectedValues.length === 1) {
      return options.find(opt => opt.value === selectedValues[0])?.label || '';
    }
    return `${selectedValues.length} selected`;
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
          {options.map(option => (
            <DropdownItem
              key={option.value}
              onClick={() => handleToggleOption(option.value)}
            >
              <Checkbox
                type="checkbox"
                checked={
                  option.value === 'all'
                    ? selectedValues.includes('all') || selectedValues.length === 0
                    : selectedValues.includes(option.value)
                }
                readOnly
              />
              <DropdownItemText>{option.label}</DropdownItemText>
            </DropdownItem>
          ))}
        </DropdownMenuContent>
      )}
    </CustomDropdownContainer>
  );
}

function renderTableHeader(column: GridColumnOrder) {
  const {key, name} = column;
  const alignment = key === 'coverage' || key === 'uploads' ? 'right' : 'left';

  return (
    <HeaderCell alignment={alignment}>
      <HeaderText>
        {name}
        {key === 'uploads' && (
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
        )}
      </HeaderText>
    </HeaderCell>
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
        <UserAvatar user={row.authorUser} size={40} />
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
        <UploadNumber>{total}</UploadNumber>
        <UploadBreakdown>
          <UploadStatus>
            <StatusDot color="#2BA185" />
            <UploadText>
              {processed} {t('Processed')}
            </UploadText>
          </UploadStatus>
          {pending > 0 && (
            <UploadStatus>
              <StatusDot color="#EBC000" />
              <UploadText>
                {pending} {t('Pending')}
              </UploadText>
            </UploadStatus>
          )}
          {failed > 0 && (
            <UploadStatus>
              <StatusDot color="#CF2126" />
              <UploadText>
                {failed} {t('Failed')}
              </UploadText>
            </UploadStatus>
          )}
        </UploadBreakdown>
      </UploadCountCell>
    );
  }

  return <AlignmentContainer alignment={alignment}>{row[key]}</AlignmentContainer>;
}

// Component to handle the organization context for commit links
function CommitCellLink({hash, children}: {children: React.ReactNode; hash: string}) {
  const organization = useOrganization();
  const commitUrl = makeCodecovPathname({
    organization,
    path: `/coverage/commits/${hash}/`,
  });

  return <StyledLink to={commitUrl}>{children}</StyledLink>;
}

export default function CommitsListPage() {
  const [selectedOrg, setSelectedOrg] = useState('turing-corp');
  const [selectedRepo, setSelectedRepo] = useState('enigma');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [activeTab, setActiveTab] = useState('commits');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUploadFilters, setSelectedUploadFilters] = useState<string[]>([
    'completed',
    'pending',
  ]);

  const location = useLocation();
  const navigate = useNavigate();

  // Pagination configuration
  const ITEMS_PER_PAGE = 5;
  const currentPage = parseInt(location.query?.page as string, 10) || 1;

  // Calculate pagination values
  const totalItems = commitsData.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageData = commitsData.slice(startIndex, endIndex);

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
    <LayoutGap>
      <ControlsContainer>
        <PageFilterBar condensed>
          <CompactSelect
            value={selectedOrg}
            options={organizationOptions}
            onChange={option => setSelectedOrg(String(option?.value))}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton
                isOpen={isOpen}
                data-test-id="page-filter-org-selector"
                {...triggerProps}
              >
                <TriggerLabelWrap>
                  <Flex align="center" gap="sm">
                    <IconContainer>
                      <IconIntegratedOrg />
                    </IconContainer>
                    <TriggerLabel>
                      {organizationOptions.find(opt => opt.value === selectedOrg)
                        ?.label || t('Select organization')}
                    </TriggerLabel>
                  </Flex>
                </TriggerLabelWrap>
              </DropdownButton>
            )}
          />

          <CompactSelect
            value={selectedRepo}
            options={repositoryOptions}
            onChange={option => setSelectedRepo(String(option?.value))}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton
                isOpen={isOpen}
                data-test-id="page-filter-repo-selector"
                {...triggerProps}
              >
                <TriggerLabelWrap>
                  <Flex align="center" gap="sm">
                    <IconContainer>
                      <IconRepository />
                    </IconContainer>
                    <TriggerLabel>
                      {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                        t('Select repo')}
                    </TriggerLabel>
                  </Flex>
                </TriggerLabelWrap>
              </DropdownButton>
            )}
          />

          <CompactSelect
            value={selectedBranch}
            options={branchOptions}
            onChange={option => setSelectedBranch(String(option?.value))}
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
                      {branchOptions.find(opt => opt.value === selectedBranch)?.label ||
                        t('Select branch')}
                    </TriggerLabel>
                  </Flex>
                </TriggerLabelWrap>
              </DropdownButton>
            )}
          />
        </PageFilterBar>

        <MultiSelectDropdown
          selectedValues={selectedUploadFilters}
          options={uploadFilterOptions}
          onChange={setSelectedUploadFilters}
        />
      </ControlsContainer>

      <TabNavigationContainer>
        <TabsList>
          {tabOptions.map(tab => (
            <TabItem
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabLabel isActive={activeTab === tab.id}>{tab.label}</TabLabel>
              <TabIndicator isActive={activeTab === tab.id} />
            </TabItem>
          ))}
        </TabsList>
      </TabNavigationContainer>

      {activeTab === 'commits' && (
        <CommitsSection>
          <CommitsFilterContainer>
            <SearchBarContainer>
              <IconSearch size="sm" />
              <SearchInput
                type="text"
                placeholder="filter by commit name, author, pull request name"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
              />
            </SearchBarContainer>
          </CommitsFilterContainer>
          <GridEditable
            aria-label={t('Commits Table')}
            isLoading={false}
            data={currentPageData}
            columnOrder={COLUMN_ORDER}
            columnSortBy={[]}
            grid={{
              renderHeadCell: renderTableHeader,
              renderBodyCell: renderTableBody,
            }}
          />
          <StyledPagination
            caption={paginationCaption}
            pageLinks={pageLinks}
            onCursor={handleCursor}
          />
        </CommitsSection>
      )}

      {activeTab === 'pulls' && (
        <PullsSection>
          <SectionHeader>Pull Requests</SectionHeader>
          <SectionContent>
            <p>Review pull requests and their coverage impact.</p>
            {/* Pull requests content will go here */}
          </SectionContent>
        </PullsSection>
      )}

      {activeTab === 'fileExplorer' && (
        <FileExplorerSection>
          <SectionHeader>File Explorer</SectionHeader>
          <SectionContent>
            <p>Browse repository files and view detailed coverage information.</p>
            {/* File explorer content will go here */}
          </SectionContent>
        </FileExplorerSection>
      )}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

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
  border-radius: 6px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 200px;
  margin-top: 4px;
`;

const TabNavigationContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 0 22px;
`;

const TabsList = styled('div')`
  display: flex;
`;

const TabItem = styled('button')<{isActive: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  border: none;
  background: none;
  cursor: pointer;
  position: relative;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const TabLabel = styled('span')<{isActive: boolean}>`
  font-family: Rubik;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.143;
  text-align: center;
  padding: 9px 0;
  color: ${p => (p.isActive ? '#6559C5' : '#3E3446')};
`;

const TabIndicator = styled('div')<{isActive: boolean}>`
  width: 100%;
  height: 3px;
  background: ${p => (p.isActive ? '#6C5FC7' : 'transparent')};
  position: absolute;
  bottom: 0;
`;

const CommitsSection = styled('div')`
  padding: ${space(1)};
`;

const PullsSection = styled('div')`
  padding: ${space(1)};
`;

const FileExplorerSection = styled('div')`
  padding: ${space(1)};
`;

const SectionHeader = styled('h2')`
  font-size: 20px;
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(2)} 0;
`;

const SectionContent = styled('div')`
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const CommitsFilterContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(3)};
  width: 100%;
`;

const SearchBarContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  flex: 1;
  max-width: 1082px;
  height: 40px;
`;

const SearchInput = styled('input')`
  border: none;
  background: none;
  outline: none;
  flex: 1;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.667;
  color: ${p => p.theme.textColor};

  &::placeholder {
    color: #80708f;
  }
`;

const DropdownItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-family: Rubik;
  font-size: 14px;
  color: ${p => p.theme.textColor};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:first-child {
    border-radius: 4px 4px 0 0;
  }

  &:last-child {
    border-radius: 0 0 4px 4px;
  }
`;

const Checkbox = styled('input')`
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #6559c5;

  &:checked {
    background-color: #6559c5;
    border-color: #6559c5;
  }
`;

const DropdownItemText = styled('span')`
  flex: 1;
`;

// Table-specific styled components
const HeaderCell = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
  padding: 12px 16px;
`;

const HeaderText = styled('span')`
  font-family: Rubik;
  font-weight: 600;
  font-size: 12px;
  line-height: 1em;
  text-transform: uppercase;
  color: #80708f;
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
  padding: 8px 16px;
  font-family: Rubik;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #2b2233;
`;

const CommitCell = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
`;

const CommitInfo = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const CommitMessage = styled('div')`
  font-family: Rubik;
  font-weight: 400;
  font-size: 18px;
  line-height: 1.4;
  color: #71637e;
`;

const CommitDetails = styled('div')`
  font-family: Rubik;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #968ba0;
`;

const AuthorName = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.subText};
`;

const CommitHashLink = styled('a')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.blue300};
  text-decoration: none;
  font-family: 'Roboto Mono', monospace;
  font-weight: 400;

  &:hover {
    color: ${p => p.theme.blue200};
    text-decoration: underline;
  }

  &:visited {
    color: ${p => p.theme.blue300};
  }
`;

const UploadCountCell = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  justify-content: flex-end;
`;

const UploadNumber = styled('div')`
  font-family: Rubik;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #2b2233;
`;

const UploadBreakdown = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 253px;
`;

const UploadStatus = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusDot = styled('div')<{color: string}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${p => p.color};
`;

const UploadText = styled('span')`
  font-family: Rubik;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  color: #71637e;
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
  gap: ${space(1.5)};
`;

const TooltipSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const TooltipTitle = styled('div')`
  font-weight: 600;
  font-size: 12px;
  color: ${p => p.theme.textColor};
`;

const TooltipDescription = styled('div')`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;
