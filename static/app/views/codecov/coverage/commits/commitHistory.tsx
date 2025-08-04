import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Tooltip} from 'sentry/components/core/tooltip';
import SearchBar from 'sentry/components/searchBar';
import {IconChevron, IconDownload, IconFlag, IconGithub, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface ReportData {
  id: string;
  name: string;
  timestamp: string;
  description?: string;
  flagName?: string;
  hasFlag?: boolean;
  isCarryForward?: boolean;
  isExpandable?: boolean;
}

export default function CommitHistoryPage() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Mock data based on the Figma design - flattened structure
  const reportData: ReportData[] = [
    {
      id: 'vitest-4-main',
      name: 'VITEST-4',
      timestamp: '7 days ago',
      description:
        'Main test suite with comprehensive coverage analysis including unit and integration tests',
      isExpandable: true,
    },
    {
      id: 'vitest-0-1',
      name: 'VITEST-0',
      timestamp: '7 days ago',
      description:
        'Backend service tests with flag-based configuration and carry forward coverage data from previous builds',
      hasFlag: true,
      flagName: 'backend',
      isCarryForward: true,
      isExpandable: true,
    },
    {
      id: 'vitest-2-1',
      name: 'VITEST-2',
      timestamp: '7 days ago',
      description:
        'Component testing suite focused on UI components and user interactions',
      isExpandable: true,
    },
    {
      id: 'vitest-1-1',
      name: 'VITEST-1',
      timestamp: '7 days ago',
      description: 'API endpoint testing with comprehensive request/response validation',
      isExpandable: true,
    },
    {
      id: 'vitest-3-1',
      name: 'VITEST-3',
      timestamp: '7 days ago',
      description: 'Database integration tests covering data models and migrations',
      isExpandable: true,
    },
    {
      id: 'vitest-4-1',
      name: 'VITEST-4',
      timestamp: '10 days ago',
      description: 'Previous build of the main test suite with legacy coverage data',
      isExpandable: true,
    },
    {
      id: 'vitest-0-2',
      name: 'VITEST-0',
      timestamp: '10 days ago',
      description: 'Earlier backend service test run with baseline coverage metrics',
      isExpandable: true,
    },
    {
      id: 'vitest-1-2',
      name: 'VITEST-1',
      timestamp: '10 days ago',
      description:
        'Previous API testing run used for coverage comparison and trend analysis',
      isExpandable: true,
    },
  ];

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleCheckbox = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const toggleAllRows = () => {
    const allExpandableIds = reportData
      .filter(report => report.isExpandable)
      .map(report => report.id);

    const allExpanded = allExpandableIds.every(id => expandedRows.has(id));

    if (allExpanded) {
      // Collapse all
      setExpandedRows(new Set());
    } else {
      // Expand all
      setExpandedRows(new Set(allExpandableIds));
    }
  };

  const allRowsExpanded = reportData
    .filter(report => report.isExpandable)
    .every(report => expandedRows.has(report.id));

  const toggleSelectAll = () => {
    const allIds = reportData.map(report => report.id);
    const allSelected = allIds.every(id => checkedItems.has(id));

    if (allSelected) {
      // Deselect all
      setCheckedItems(new Set());
    } else {
      // Select all
      setCheckedItems(new Set(allIds));
    }
  };

  const allItemsSelected = reportData.every(report => checkedItems.has(report.id));
  const someItemsSelected = reportData.some(report => checkedItems.has(report.id));

  return (
    <LayoutGap>
      <HeaderSection>
        <Title>Coverage reports history log (8)</Title>
        <Description>
          View all your processed reports in this history log. You have 16{' '}
          <Tooltip
            title="Reports that have been successfully uploaded and analyzed for code coverage data. These reports contain coverage information from your test runs."
            position="top"
          >
            <TooltipTrigger>reports processed</TooltipTrigger>
          </Tooltip>
          , 2{' '}
          <Tooltip
            title="Reports from previous commits that are reused when no new coverage data is available for specific files. This helps maintain coverage continuity across commits."
            position="top"
          >
            <TooltipTrigger>carried forward</TooltipTrigger>
          </Tooltip>
          .
        </Description>
      </HeaderSection>
      <SearchContainer>
        <SearchBar placeholder="filter by upload name or flag name" onChange={() => {}} />
      </SearchContainer>

      <TableContainer>
        <TableHeader>
          <HeaderButtons>
            {/* <StyledButton size="xs" disabled>
              <IconDownload size="xs" />
              Download
            </StyledButton> */}
            <StyledButton size="xs" disabled>
              <IconWarning size="xs" />0 processing error
            </StyledButton>
            <ExpandAllButton size="xs" onClick={toggleAllRows}>
              {allRowsExpanded ? 'Collapse All' : 'Expand All'}
            </ExpandAllButton>
          </HeaderButtons>
        </TableHeader>

        <TableHeaderRow>
          <TableHeaderCell>
            <StyledCheckbox
              checked={
                allItemsSelected
                  ? true
                  : someItemsSelected && !allItemsSelected
                    ? 'indeterminate'
                    : false
              }
              onChange={toggleSelectAll}
            />
            <HeaderText>Provider not specified</HeaderText>
          </TableHeaderCell>
        </TableHeaderRow>

        <TableContent>
          {reportData.map(report => (
            <TableSection key={report.id}>
              <MainRow isExpanded={expandedRows.has(report.id)}>
                <RowContent>
                  <Leading>
                    <StyledCheckbox
                      checked={checkedItems.has(report.id)}
                      onChange={() => toggleCheckbox(report.id)}
                    />
                    <CheckboxLabel fontWeight={400}>{report.name}</CheckboxLabel>
                    <IconGithub size="xs" color="gray400" />
                    <IconDownload size="xs" color="gray400" />
                    {report.hasFlag && (
                      <FlagContainer>
                        <VerticalDivider />
                        <FlagSection>
                          <IconFlag size="xs" color="gray400" />
                          <FlagText>{report.flagName}</FlagText>
                          {report.isCarryForward && (
                            <CarryForwardTag>carry forward flag</CarryForwardTag>
                          )}
                        </FlagSection>
                      </FlagContainer>
                    )}
                    {report.timestamp && <Timestamp>{report.timestamp}</Timestamp>}
                  </Leading>
                  {report.isExpandable && (
                    <Trailing>
                      <ExpandButton onClick={() => toggleRow(report.id)}>
                        <IconChevron
                          direction={expandedRows.has(report.id) ? 'up' : 'down'}
                          size="xs"
                        />
                      </ExpandButton>
                    </Trailing>
                  )}
                </RowContent>
              </MainRow>

              {report.isExpandable && expandedRows.has(report.id) && (
                <ExpandedContent>
                  <DescriptionRow>
                    <DescriptionText>{report.description}</DescriptionText>
                  </DescriptionRow>
                </ExpandedContent>
              )}
            </TableSection>
          ))}
        </TableContent>
      </TableContainer>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
  width: 100%;
  max-width: 1257px;
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const Title = styled('h2')`
  font-family: Rubik, sans-serif;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -0.64%;
  color: #2b2233;
  margin: 0;
`;

const Description = styled('p')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #71637e;
  margin: 0;
`;

const SearchContainer = styled('div')`
  width: 100%;

  form {
    [role='group'] {
      border: 1px solid #e0dce5;
      border-radius: 6px;
      background: #ffffff;
    }
  }

  input {
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;

    &::placeholder {
      color: #80708f;
    }
  }
`;

const TooltipTrigger = styled('span')`
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: help;
  color: #71637e;

  &:hover {
    color: #2b2233;
  }
`;

// Table-specific styled components
const TableContainer = styled('div')`
  width: 100%;
  max-width: 1257px;
  border: 1px solid #e0dce5;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
`;

const TableHeader = styled('div')`
  background: #faf9fb;
  border-bottom: 1px solid #e0dce5;
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderButtons = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledButton = styled(Button)`
  opacity: 0.65;

  svg {
    margin-right: ${space(0.5)};
  }
`;

const ExpandAllButton = styled(Button)`
  svg {
    margin-right: ${space(0.5)};
  }

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
`;

const TableHeaderRow = styled('div')`
  display: flex;
  align-items: center;
  background: #f8f7fa;
  border-bottom: 1px solid #e0dce5;
  padding: ${space(1)} ${space(1.5)};
  font-weight: 500;
`;

const TableHeaderCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  flex: 1;
`;

const HeaderText = styled('span')`
  font-family: Rubik, sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 1.2;
  color: #71637e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TableContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const TableSection = styled('div')`
  &:not(:last-child) {
    border-bottom: 1px solid #e0dce5;
  }
`;

const MainRow = styled('div')<{isExpanded?: boolean}>`
  background: #faf9fb;
  border-bottom: ${props => (props.isExpanded ? '1px solid #e0dce5' : 'none')};
`;

const RowContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1.5)} ${space(1.5)};
  gap: ${space(1)};
`;

const Leading = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
  flex: 1;
`;

const Trailing = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
`;

const StyledCheckbox = styled(Checkbox)`
  /* Custom checkbox styling if needed */
`;

const CheckboxLabel = styled('span')<{fontWeight?: number}>`
  font-family: Rubik, sans-serif;
  font-weight: ${props => props.fontWeight || 400};
  font-size: 14px;
  line-height: 1.4;
  color: #3e3446;
`;

const Timestamp = styled('span')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  color: #3e3446;
  margin-left: auto;
  text-align: right;
`;

const ExpandButton = styled('button')`
  background: none;
  border: none;
  padding: ${space(0.5)};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }
`;

const ExpandedContent = styled('div')`
  background: #ffffff;
`;

const DescriptionRow = styled('div')`
  padding: ${space(2)} ${space(1.5)};
`;

const DescriptionText = styled('p')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #71637e;
  margin: 0;
`;

const FlagContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

const VerticalDivider = styled('div')`
  width: 0;
  height: 14px;
  border-left: 1px solid #e0dce5;
`;

const FlagSection = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const FlagText = styled('span')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #3e3446;
`;

const CarryForwardTag = styled('span')`
  background: rgba(108, 95, 199, 0.1);
  border: 1px solid rgba(108, 95, 199, 0.09);
  border-radius: 17px;
  padding: 2px ${space(1)};
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.33;
  color: #6559c5;
`;
