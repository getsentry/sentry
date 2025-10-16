import React, {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {TreeCoverageSunburstChart} from 'sentry/components/charts/treeCoverageSunburstChart';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Tooltip} from 'sentry/components/core/tooltip';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SplitPanel from 'sentry/components/splitPanel';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {
  IconArrow,
  IconCheckmark,
  IconChevron,
  IconClose,
  IconCommit,
  IconFile,
  IconGithub,
  IconOpen,
  IconSearch,
  IconSync,
} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {IconBuilding} from 'sentry/icons/iconBuilding';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import CoverageTrendPage from 'sentry/views/prevent/coverage/coverageTrend';
import {makePreventPathname} from 'sentry/views/prevent/pathnames';
import {PREVENT_BASE_URL} from 'sentry/views/prevent/settings';
import {
  SummaryContainer,
  SummaryEntries,
  SummaryEntry,
  SummaryEntryLabel,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/views/summary';

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
  {id: 'coverageTrend', label: 'Coverage Trend'},
];

const uploadFilterOptions = [
  {value: 'all', label: 'All uploads'},
  {value: 'completed', label: 'Completed'},
  {value: 'pending', label: 'Pending'},
  {value: 'error', label: 'Error'},
];

// Mock pull requests data
const pullRequestsData = [
  {
    id: '1',
    title: 'steps4: add smiles',
    number: 10,
    author: 'Flamefire',
    status: 'open',
    timestamp: '1 day ago',
    coverage: '87.50%',
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
    title: 'steps3: add Codecov badge',
    number: 9,
    author: 'Maya Rodriguez',
    status: 'open',
    timestamp: '1 day ago',
    coverage: null,
    authorUser: {
      id: '2',
      email: 'maya.rodriguez@example.com',
      name: 'Maya Rodriguez',
      username: 'mayarod',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/7654321?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '3',
    title: 'step3: add project status check target',
    number: 7,
    author: 'Alex Chen',
    status: 'open',
    timestamp: '1 day ago',
    coverage: null,
    authorUser: {
      id: '3',
      email: 'alex.chen@example.com',
      name: 'Alex Chen',
      username: 'alexchen',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/9876543?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '4',
    title: 'steps3: cover divide by 0 case',
    number: 8,
    author: 'Sarah Johnson',
    status: 'open',
    timestamp: '1 day ago',
    coverage: '100%',
    authorUser: {
      id: '4',
      email: 'sarah.johnson@example.com',
      name: 'Sarah Johnson',
      username: 'sarahj',
      ip_address: '',
      avatar: {
        avatarUrl: null,
        avatarType: 'gravatar' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '5',
    title: 'step3: add project status check target',
    number: 6,
    author: 'David Kim',
    status: 'open',
    timestamp: '1 day ago',
    coverage: null,
    authorUser: {
      id: '5',
      email: 'david.kim@example.com',
      name: 'David Kim',
      username: 'dkim',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/5432109?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '6',
    title: 'step2: upload coverage reports to Codecov',
    number: 5,
    author: 'Emma Thompson',
    status: 'open',
    timestamp: '1 day ago',
    coverage: null,
    authorUser: {
      id: '6',
      email: 'emma.thompson@example.com',
      name: 'Emma Thompson',
      username: 'emmathompson',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/9876543?v=4',
        avatarType: 'gravatar' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '7',
    title: 'step1: create initial project structure',
    number: 4,
    author: 'Marcus Johnson',
    status: 'merged',
    timestamp: '2 days ago',
    coverage: '95%',
    authorUser: {
      id: '7',
      email: 'marcus.johnson@example.com',
      name: 'Marcus Johnson',
      username: 'marcusj',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/1357924?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '8',
    title: 'initial commit setup',
    number: 3,
    author: 'Priya Patel',
    status: 'merged',
    timestamp: '3 days ago',
    coverage: '88%',
    authorUser: {
      id: '8',
      email: 'priya.patel@example.com',
      name: 'Priya Patel',
      username: 'priyap',
      ip_address: '',
      avatar: {
        avatarUrl: 'https://avatars.githubusercontent.com/u/2468135?v=4',
        avatarType: 'upload' as const,
        avatarUuid: null,
      },
    },
  },
  {
    id: '9',
    title: 'fix typo in documentation',
    number: 2,
    author: 'Jake Wilson',
    status: 'merged',
    timestamp: '4 days ago',
    coverage: null,
    authorUser: {
      id: '9',
      email: 'jake.wilson@example.com',
      name: 'Jake Wilson',
      username: 'jakew',
      ip_address: '',
      avatar: {
        avatarUrl: null,
        avatarType: 'gravatar' as const,
        avatarUuid: null,
      },
    },
  },
  // Add closed pull requests to match the design
  ...Array.from({length: 35}, (_, index) => {
    const authors = [
      'Lisa Wang',
      'Carlos Rivera',
      'Aisha Okafor',
      "Ryan O'Connor",
      'Fatima Al-Zahra',
      'Hiroshi Tanaka',
      'Elena Petrov',
      'Ahmed Hassan',
      'Sophie Dubois',
      'Raj Sharma',
      'Isabella Santos',
      'Dmitri Volkov',
      'Zara Khan',
      'Lucas Anderson',
      'Mei Chen',
      'Omar Benali',
      'Ingrid Larsson',
      'Kenji Nakamura',
      'Nadia Popov',
      'Gabriel Silva',
      'Yuki Sato',
      'Amara Osei',
      'Viktor Kozlov',
      'Camila Torres',
      'Hassan Ali',
      'Nina Johansson',
      'Arjun Gupta',
      'Leila Moradi',
      'Diego Fernandez',
      'Anya Petrov',
      'Kwame Asante',
      'Sakura Yamamoto',
      'Mateo Rodriguez',
      'Zoe Mitchell',
      'Tariq Mahmoud',
    ];
    const author = authors[index % authors.length]!;
    const username = author
      .toLowerCase()
      .replace(/['\s]/g, '')
      .replace("o'connor", 'oconnor');
    const email = `${username}@example.com`;

    return {
      id: `closed-${index + 1}`,
      title: `Closed PR ${index + 1}`,
      number: 100 + index,
      author,
      status: 'closed',
      timestamp: `${Math.floor(index / 7) + 1} weeks ago`,
      coverage: index % 3 === 0 ? `${80 + (index % 20)}%` : null,
      authorUser: {
        id: `closed-${index + 1}`,
        email,
        name: author,
        username,
        ip_address: '',
      },
    };
  }),
];

// Mock data for uncovered lines table
const uncoveredLinesData = [
  {
    id: 1,
    filePath: 'src/components/Button.tsx',
    headCoverage: '95%',
    patchCoverage: '95%',
    uncoveredLines: 2,
    diffSections: [
      {
        id: 1,
        header: '@@ -15,8 +15,10 @@',
        lines: [
          {
            lineNumber: {old: 15, new: 15},
            code: 'export function Button({ variant, children, ...props }) {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 16, new: 16},
            code: '  const handleClick = useCallback(() => {',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 17, new: 17},
            code: '    console.log("Button clicked");',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 18, new: 18},
            code: '  }, []);',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    filePath: 'src/components/Modal.tsx',
    headCoverage: '88%',
    patchCoverage: '88%',
    uncoveredLines: 3,
    diffSections: [
      {
        id: 1,
        header: '@@ -25,6 +25,8 @@',
        lines: [
          {
            lineNumber: {old: 25, new: 25},
            code: 'const Modal = ({ isOpen, onClose, children }) => {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 26, new: 26},
            code: '  if (!isOpen) return null;',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 27, new: 27},
            code: '  const handleEscape = (e) => {',
            type: 'partially-covered' as const,
            coverage: 'partially-covered' as const,
          },
          {
            lineNumber: {old: 28, new: 28},
            code: '    if (e.key === "Escape") onClose();',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
        ],
      },
    ],
  },
  {
    id: 3,
    filePath: 'src/components/Form.tsx',
    headCoverage: '76%',
    patchCoverage: '76%',
    uncoveredLines: 5,
    diffSections: [
      {
        id: 1,
        header: '@@ -12,6 +12,8 @@',
        lines: [
          {
            lineNumber: {old: 12, new: 12},
            code: 'const validateForm = (data) => {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 13, new: 13},
            code: '  if (!data.email) return false;',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 14, new: 14},
            code: '  if (!data.password) return false;',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 15, new: 15},
            code: '  return true;',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
        ],
      },
    ],
  },
  {
    id: 4,
    filePath: 'src/services/api.ts',
    headCoverage: '72%',
    patchCoverage: '72%',
    uncoveredLines: 4,
    diffSections: [
      {
        id: 1,
        header: '@@ -45,4 +45,6 @@',
        lines: [
          {
            lineNumber: {old: 45, new: 45},
            code: 'export const fetchUser = async (id: string) => {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 46, new: 46},
            code: '  try {',
            type: 'covered' as const,
            coverage: 'covered' as const,
          },
          {
            lineNumber: {old: 47, new: 47},
            code: '    return await api.get(`/users/${id}`);',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 48, new: 48},
            code: '  } catch (error) {',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 49, new: 49},
            code: '    console.error("Failed to fetch user:", error);',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 50, new: 50},
            code: '    throw error;',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
        ],
      },
    ],
  },
  {
    id: 5,
    filePath: 'src/services/auth.ts',
    headCoverage: '23%',
    patchCoverage: '23%',
    uncoveredLines: 8,
    diffSections: [
      {
        id: 1,
        header: '@@ -20,8 +20,12 @@',
        lines: [
          {
            lineNumber: {old: 20, new: 20},
            code: 'export const login = async (credentials) => {',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 21, new: 21},
            code: '  const response = await fetch("/api/login", {',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 22, new: 22},
            code: '    method: "POST",',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 23, new: 23},
            code: '    body: JSON.stringify(credentials),',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
          {
            lineNumber: {old: 24, new: 24},
            code: '  });',
            type: 'uncovered' as const,
            coverage: 'uncovered' as const,
          },
        ],
      },
    ],
  },
];

// Mock head and base commit data for the SummaryContainer
const headCommit = {
  sha: '31b72ff64bd75326ea5e43bf8e93b415db56cb62',
  shortSha: 'd677638',
};

// Type definitions for coverage data
type CoverageType = 'covered' | 'uncovered' | 'partially-covered';

type LineData = {
  code: string;
  coverage: CoverageType;
  lineNumber: {new: number; old: number};
  type: CoverageType;
};

type DiffSection = {
  header: string;
  id: number;
  lines: LineData[];
};

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

// File tree types and data
interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  coverage?: string;
  fullPath?: string;
  isExpanded?: boolean;
  level?: number;
  uncoveredLines?: number;
}

// Mock file tree data with realistic project structure
const fileTreeData: FileTreeNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    isExpanded: true,
    level: 0,
    coverage: '85%',
    uncoveredLines: 287,
    children: [
      {
        id: 'src/components',
        name: 'components',
        type: 'folder',
        isExpanded: true,
        level: 1,
        coverage: '92%',
        uncoveredLines: 45,
        children: [
          {
            id: 'src/components/Button.tsx',
            name: 'Button.tsx',
            type: 'file',
            level: 2,
            coverage: '95%',
            uncoveredLines: 8,
          },
          {
            id: 'src/components/Modal.tsx',
            name: 'Modal.tsx',
            type: 'file',
            level: 2,
            coverage: '88%',
            uncoveredLines: 15,
          },
          {
            id: 'src/components/Form.tsx',
            name: 'Form.tsx',
            type: 'file',
            level: 2,
            coverage: '76%',
            uncoveredLines: 22,
          },
        ],
      },
      {
        id: 'src/utils',
        name: 'utils',
        type: 'folder',
        isExpanded: false,
        level: 1,
        coverage: '67%',
        uncoveredLines: 87,
      },
      {
        id: 'src/hooks',
        name: 'hooks',
        type: 'folder',
        isExpanded: false,
        level: 1,
        coverage: '81%',
        uncoveredLines: 34,
      },
      {
        id: 'src/services',
        name: 'services',
        type: 'folder',
        isExpanded: true,
        level: 1,
        coverage: '45%',
        uncoveredLines: 98,
        children: [
          {
            id: 'src/services/api.ts',
            name: 'api.ts',
            type: 'file',
            level: 2,
            coverage: '72%',
            uncoveredLines: 28,
          },
          {
            id: 'src/services/auth.ts',
            name: 'auth.ts',
            type: 'file',
            level: 2,
            coverage: '23%',
            uncoveredLines: 70,
          },
        ],
      },
      {
        id: 'src/App.tsx',
        name: 'App.tsx',
        type: 'file',
        level: 1,
        coverage: '100%',
        uncoveredLines: 0,
      },
      {
        id: 'src/index.tsx',
        name: 'index.tsx',
        type: 'file',
        level: 1,
        coverage: '100%',
        uncoveredLines: 0,
      },
    ],
  },
  {
    id: 'tests',
    name: 'tests',
    type: 'folder',
    isExpanded: false,
    level: 0,
    coverage: '78%',
    uncoveredLines: 56,
  },
  {
    id: 'public',
    name: 'public',
    type: 'folder',
    isExpanded: false,
    level: 0,
    uncoveredLines: 0,
  },
  {
    id: 'package_json',
    name: 'package.json',
    type: 'file',
    level: 0,
    uncoveredLines: 0,
  },
  {
    id: 'tsconfig_json',
    name: 'tsconfig.json',
    type: 'file',
    level: 0,
    uncoveredLines: 0,
  },
  {
    id: 'readme_md',
    name: 'README.md',
    type: 'file',
    level: 0,
    uncoveredLines: 0,
  },
];

// Mock data for the sunburst chart
const sunburstData = {
  name: 'src',
  fullPath: 'src',
  coverage: 85,
  children: [
    {
      name: 'components',
      fullPath: 'src/components',
      coverage: 92,
      children: [
        {
          name: 'Button.tsx',
          fullPath: 'src/components/Button.tsx',
          coverage: 95,
          value: 1,
          children: [],
        },
        {
          name: 'Modal.tsx',
          fullPath: 'src/components/Modal.tsx',
          coverage: 88,
          value: 1,
          children: [],
        },
        {
          name: 'Form.tsx',
          fullPath: 'src/components/Form.tsx',
          coverage: 76,
          value: 1,
          children: [],
        },
      ],
    },
    {
      name: 'utils',
      fullPath: 'src/utils',
      coverage: 67,
      children: [
        {
          name: 'helpers.ts',
          fullPath: 'src/utils/helpers.ts',
          coverage: 65,
          value: 1,
          children: [],
        },
        {
          name: 'validation.ts',
          fullPath: 'src/utils/validation.ts',
          coverage: 70,
          value: 1,
          children: [],
        },
      ],
    },
    {
      name: 'hooks',
      fullPath: 'src/hooks',
      coverage: 81,
      children: [
        {
          name: 'useAuth.ts',
          fullPath: 'src/hooks/useAuth.ts',
          coverage: 85,
          value: 1,
          children: [],
        },
        {
          name: 'useData.ts',
          fullPath: 'src/hooks/useData.ts',
          coverage: 78,
          value: 1,
          children: [],
        },
      ],
    },
    {
      name: 'services',
      fullPath: 'src/services',
      coverage: 45,
      children: [
        {
          name: 'api.ts',
          fullPath: 'src/services/api.ts',
          coverage: 72,
          value: 1,
          children: [],
        },
        {
          name: 'auth.ts',
          fullPath: 'src/services/auth.ts',
          coverage: 23,
          value: 1,
          children: [],
        },
      ],
    },
    {
      name: 'App.tsx',
      fullPath: 'src/App.tsx',
      coverage: 100,
      value: 1,
      children: [],
    },
    {
      name: 'index.tsx',
      fullPath: 'src/index.tsx',
      coverage: 100,
      value: 1,
      children: [],
    },
  ],
};

const COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'commit', name: t('Commits'), width: COL_WIDTH_UNDEFINED},
  {key: 'uploads', name: t('Upload count'), width: COL_WIDTH_UNDEFINED},
  {key: 'coverage', name: t('Patch coverage'), width: COL_WIDTH_UNDEFINED},
];

const PULLS_COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'pullRequest', name: t('Pull Requests'), width: COL_WIDTH_UNDEFINED},
  {key: 'coverage', name: t('Patch coverage'), width: COL_WIDTH_UNDEFINED},
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

function renderPullsTableHeader(
  column: GridColumnOrder,
  pullRequestCounts: any,
  pullRequestStatus: string,
  setPullRequestStatus: (status: string) => void,
  sort: {field: string; order: 'asc' | 'desc'} | null,
  onSortChange: (field: string, order: 'asc' | 'desc') => void,
  location: any
) {
  const {key, name} = column;
  const alignment = key === 'coverage' ? 'right' : 'left';

  const sortKey = String(key);
  const currentDirection = sort?.field === sortKey ? sort.order : undefined;
  const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';

  if (key === 'pullRequest') {
    return (
      <PullRequestHeaderContainer>
        <PullRequestTitleRow>
          <SortLink
            align={alignment}
            title={name}
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
        </PullRequestTitleRow>
        <PullRequestControlRow>
          <SegmentedControl
            size="xs"
            value={pullRequestStatus}
            onChange={(value: string) => setPullRequestStatus(value)}
          >
            <SegmentedControl.Item key="open">
              {pullRequestCounts.open} Open
            </SegmentedControl.Item>
            <SegmentedControl.Item key="merged">
              {pullRequestCounts.merged} Merged
            </SegmentedControl.Item>
            <SegmentedControl.Item key="closed">
              {pullRequestCounts.closed} Closed
            </SegmentedControl.Item>
          </SegmentedControl>
        </PullRequestControlRow>
      </PullRequestHeaderContainer>
    );
  }

  return (
    <SortLink
      align={alignment}
      title={name}
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

function renderPullsTableBody(
  column: GridColumnOrder,
  row: any,
  rowIndex: number,
  _columnIndex: number
) {
  const key = String(column.key);
  const alignment = ['coverage'].includes(key) ? 'right' : 'left';

  if (key === 'pullRequest') {
    const pullRequestCell = (
      <CommitCell>
        <UserAvatar user={row.authorUser} size={40} gravatar />
        <CommitInfo>
          <CommitMessage>
            {rowIndex === 0 ? (
              row.title
            ) : (
              <PullRequestCellLink pullId={row.number}>{row.title}</PullRequestCellLink>
            )}
          </CommitMessage>
          <CommitDetails>
            <AuthorName>{row.author}</AuthorName> opened{' '}
            <PullRequestLink
              href={`https://github.com/example-org/example-repo/pull/${row.number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGithub size="xs" />#{row.number}
            </PullRequestLink>{' '}
            • {row.timestamp}
          </CommitDetails>
        </CommitInfo>
      </CommitCell>
    );

    // Make the first row clickable and link to pull request detail
    if (rowIndex === 0) {
      return (
        <PullRequestCellLink pullId={row.number}>{pullRequestCell}</PullRequestCellLink>
      );
    }

    return pullRequestCell;
  }

  if (key === 'coverage') {
    return <AlignmentContainer alignment={alignment}>{row.coverage}</AlignmentContainer>;
  }

  return <AlignmentContainer alignment={alignment}>{row[key]}</AlignmentContainer>;
}

// Component to handle the organization context for commit links
function CommitCellLink({hash, children}: {children: React.ReactNode; hash: string}) {
  const organization = useOrganization();
  const commitUrl = makePreventPathname({
    organization,
    path: `/${PREVENT_BASE_URL}/commits/${hash}/`,
  });

  return <StyledLink to={commitUrl}>{children}</StyledLink>;
}

// Component to handle the organization context for pull request links
function PullRequestCellLink({
  pullId,
  children,
}: {
  children: React.ReactNode;
  pullId: number;
}) {
  const organization = useOrganization();
  const pullUrl = makePreventPathname({
    organization,
    path: `/${PREVENT_BASE_URL}/pulls/${pullId}/`,
  });

  return <StyledLink to={pullUrl}>{children}</StyledLink>;
}

// Coverage Legend Component
function CoverageLegend() {
  return (
    <InlineLegendContainer>
      <InlineLegendTitle>{t('Coverage Legend')}</InlineLegendTitle>
      <LegendItems>
        <LegendItem>
          <LegendColorBox $color="green" />
          <LegendLabel>{t('Covered')}</LegendLabel>
        </LegendItem>
        <LegendItem>
          <LegendColorBox $color="orange" />
          <LegendLabel>{t('Partial')}</LegendLabel>
        </LegendItem>
        <LegendItem>
          <LegendColorBox $color="red" />
          <LegendLabel>{t('Uncovered')}</LegendLabel>
        </LegendItem>
      </LegendItems>
    </InlineLegendContainer>
  );
}

// Helper function to get the full path of a node within the file tree
const getNodeFullPath = (
  targetNode: FileTreeNode,
  _nodes: FileTreeNode[],
  _currentPath = ''
): string => {
  // Since we're now using full paths as IDs, we can just return the ID
  return targetNode.id;
};

// UncoveredLinesTable Component for File Details
type SortField = 'filePath' | 'uncoveredLines' | 'headCoverage' | 'patchCoverage';
type SortDirection = 'asc' | 'desc';

function UncoveredLinesTable({
  fileData,
  fileTree,
  onBackToResults,
  pathFilter,
}: {
  fileData?: any;
  fileTree?: FileTreeNode[];
  onBackToResults?: () => void;
  pathFilter?: string;
}) {
  const [sortField, setSortField] = useState<SortField>('uncoveredLines');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter data by selected file or folder if provided
  const filteredData = useMemo(() => {
    return fileData
      ? uncoveredLinesData.filter(item => {
          if (fileData.type === 'file') {
            // For files, get the full path and match exactly
            const fullPath = getNodeFullPath(fileData, fileTree || []);
            return item.filePath === fullPath;
          }
          if (fileData.type === 'folder' && fileTree) {
            // For folders, find all files within that folder path
            const folderPath = getNodeFullPath(fileData, fileTree);
            return item.filePath.startsWith(folderPath + '/');
          }
          return true;
        })
      : uncoveredLinesData;
  }, [fileData, fileTree]);

  // Initialize expandedRows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Effect to expand the last row by default when data changes
  useEffect(() => {
    const lastItem = filteredData[filteredData.length - 1];
    if (filteredData.length > 0 && lastItem) {
      setExpandedRows(new Set([lastItem.id]));
    } else {
      setExpandedRows(new Set());
    }
  }, [filteredData]);

  const toggleRow = (rowId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(rowId)) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const allRowIds = filteredData.map(item => item.id);
  const allExpanded = allRowIds.every(id => expandedRows.has(id));
  const allCollapsed = allRowIds.every(id => !expandedRows.has(id));

  const handleToggleAll = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(allRowIds));
    }
  };

  const getToggleAllLabel = () => {
    if (allExpanded || (!allExpanded && !allCollapsed)) {
      return t('Collapse All');
    }
    return t('Expand All');
  };

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: string;
    let bValue: string;

    switch (sortField) {
      case 'filePath':
        aValue = a.filePath;
        bValue = b.filePath;
        break;
      case 'uncoveredLines':
        aValue = a.uncoveredLines.toString();
        bValue = b.uncoveredLines.toString();
        break;
      case 'headCoverage':
        aValue = a.headCoverage;
        bValue = b.headCoverage;
        break;
      case 'patchCoverage':
        aValue = a.patchCoverage;
        bValue = b.patchCoverage;
        break;
      default:
        aValue = a.filePath;
        bValue = b.filePath;
        break;
    }

    if (sortField === 'uncoveredLines') {
      const aNum = parseInt(aValue, 10);
      const bNum = parseInt(bValue, 10);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    if (sortField === 'headCoverage' || sortField === 'patchCoverage') {
      const aNum = parseInt(aValue.replace('%', ''), 10);
      const bNum = parseInt(bValue.replace('%', ''), 10);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (filteredData.length === 0) {
    return (
      <div>
        <TableTitleContainer>
          <TableTitle>{t('No uncovered lines found')}</TableTitle>
        </TableTitleContainer>
        <UncoveredLinesPanel>
          <div style={{padding: '2rem', textAlign: 'center', color: '#666'}}>
            {t('This file has 100% coverage')}
          </div>
        </UncoveredLinesPanel>
      </div>
    );
  }

  return (
    <div>
      <TableTitleContainer>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          {onBackToResults && pathFilter && (
            <button
              onClick={onBackToResults}
              style={{
                background: 'none',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Back to "{pathFilter}" results
            </button>
          )}
          <TableTitle>
            {fileData && fileData.type === 'folder'
              ? t('Uncovered lines in %s (%s)', fileData.name, filteredData.length)
              : t('Uncovered lines (%s)', filteredData.length)}
          </TableTitle>
        </div>
        <CoverageLegend />
      </TableTitleContainer>
      <UncoveredLinesPanel>
        <TableContainer>
          <TableHeaderRow>
            <SortableFilePathHeader
              onClick={() => handleSort('filePath')}
              isActive={sortField === 'filePath'}
            >
              <ToggleAllButton
                onClick={e => {
                  e.stopPropagation();
                  handleToggleAll();
                }}
              >
                {getToggleAllLabel()}
              </ToggleAllButton>
              <FilePathLabel>
                {t('File path')}
                <SortIcon
                  $isActive={sortField === 'filePath'}
                  direction={sortDirection === 'asc' ? 'up' : 'down'}
                  size="xs"
                />
              </FilePathLabel>
            </SortableFilePathHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('uncoveredLines')}
              isActive={sortField === 'uncoveredLines'}
            >
              {t('Uncovered')}
              <SortIcon
                $isActive={sortField === 'uncoveredLines'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
            </SortableCoverageHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('headCoverage')}
              isActive={sortField === 'headCoverage'}
            >
              {t('HEAD %')}
              <SortIcon
                $isActive={sortField === 'headCoverage'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
            </SortableCoverageHeader>
            <SortableCoverageHeader
              onClick={() => handleSort('patchCoverage')}
              isActive={sortField === 'patchCoverage'}
            >
              {t('patch %')}
              <SortIcon
                $isActive={sortField === 'patchCoverage'}
                direction={sortDirection === 'asc' ? 'up' : 'down'}
                size="xs"
              />
            </SortableCoverageHeader>
          </TableHeaderRow>

          {sortedData.map(fileLineData => (
            <Fragment key={fileLineData.id}>
              <TableRow>
                <FilePathCell onClick={() => toggleRow(fileLineData.id)}>
                  <ChevronIcon
                    isExpanded={expandedRows.has(fileLineData.id)}
                    direction={expandedRows.has(fileLineData.id) ? 'down' : 'right'}
                    size="sm"
                  />
                  <FilePath>{fileLineData.filePath}</FilePath>
                </FilePathCell>
                <UncoveredLinesCell>{fileLineData.uncoveredLines}</UncoveredLinesCell>
                <CoverageCell>{fileLineData.headCoverage}</CoverageCell>
                <CoverageCell>{fileLineData.patchCoverage}</CoverageCell>
              </TableRow>

              {expandedRows.has(fileLineData.id) && (
                <ExpandedRow>
                  <ExpandedContent>
                    {fileLineData.diffSections.map(section => (
                      <DiffSection key={section.id}>
                        <DiffHeader>
                          <DiffHeaderText>{section.header}</DiffHeaderText>
                          <DiffHeaderActions>
                            <IconGithub size="xs" />
                            <IconOpen size="xs" />
                          </DiffHeaderActions>
                        </DiffHeader>
                        <CodeBlock>
                          {section.lines.map((line, index) => {
                            const coverageType = line.coverage || 'uncovered';
                            return (
                              <CodeLine key={index} lineType={coverageType}>
                                <LineNumber lineType={coverageType}>
                                  {line.lineNumber.old}
                                </LineNumber>
                                <LineNumber lineType={coverageType}>
                                  {line.lineNumber.new}
                                </LineNumber>
                                <CodeContent>
                                  <CodeText lineType={coverageType}>{line.code}</CodeText>
                                </CodeContent>
                              </CodeLine>
                            );
                          })}
                        </CodeBlock>
                      </DiffSection>
                    ))}
                  </ExpandedContent>
                </ExpandedRow>
              )}
            </Fragment>
          ))}
        </TableContainer>
      </UncoveredLinesPanel>
    </div>
  );
}

// FileTree component
interface FileTreeProps {
  nodes: FileTreeNode[];
  displayMode?: 'coverage' | 'uncovered';
  matchingFiles?: FileTreeNode[];
  onDisplayModeChange?: (mode: 'coverage' | 'uncovered') => void;
  onNodeSelect?: (node: FileTreeNode) => void;
  onToggle?: (nodeId: string) => void;
  pathFilter?: string;
  selectedNode?: FileTreeNode | null;
}

function FileTree({
  nodes,
  onToggle,
  selectedNode,
  onNodeSelect,
  displayMode = 'coverage',
  onDisplayModeChange,
  pathFilter,
}: FileTreeProps) {
  // Helper function to check if a node or its children match the filter
  const nodeOrChildrenMatchFilter = (node: FileTreeNode, currentPath = ''): boolean => {
    if (!pathFilter) return true;

    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

    // Check if this node matches
    if (nodePath.toLowerCase().includes(pathFilter.toLowerCase())) {
      return true;
    }

    // Check if any children match
    if (node.children) {
      return node.children.some(child => nodeOrChildrenMatchFilter(child, nodePath));
    }

    return false;
  };

  // Helper function to check if a node matches the filter directly
  const nodeMatchesFilter = (node: FileTreeNode, currentPath = ''): boolean => {
    if (!pathFilter) return false;
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
    return nodePath.toLowerCase().includes(pathFilter.toLowerCase());
  };

  const renderNode = (node: FileTreeNode, currentPath = '') => {
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
    const indentation = (node.level || 0) * 16;
    const isSelected = selectedNode?.id === node.id;
    const nodeMatches = nodeMatchesFilter(node, currentPath);
    const shouldShow = !pathFilter || nodeOrChildrenMatchFilter(node, currentPath);

    if (!shouldShow) return null;

    return (
      <div key={node.id}>
        <FileTreeItem
          $level={node.level || 0}
          $isSelected={isSelected}
          $isFiltered={nodeMatches}
        >
          <FileTreeContent
            style={{paddingLeft: `${indentation}px`}}
            onClick={() => onNodeSelect?.(node)}
          >
            <FileTreeToggle>
              {node.type === 'folder' && (
                <FileTreeChevron
                  $isExpanded={node.isExpanded || false}
                  onClick={e => {
                    e.stopPropagation();
                    onToggle?.(node.id);
                  }}
                >
                  <IconChevron direction={node.isExpanded ? 'down' : 'right'} size="xs" />
                </FileTreeChevron>
              )}
            </FileTreeToggle>

            <FileTreeIcon>
              {node.type === 'folder' ? (
                <FolderIcon $isExpanded={node.isExpanded || false} />
              ) : (
                <IconFile size="sm" color="gray300" />
              )}
            </FileTreeIcon>

            <FileTreeName $isHighlighted={nodeMatches}>{node.name}</FileTreeName>

            {displayMode === 'coverage' && node.coverage && (
              <Tag
                type={
                  parseInt(node.coverage.replace('%', ''), 10) >= 80
                    ? 'success'
                    : parseInt(node.coverage.replace('%', ''), 10) >= 50
                      ? 'warning'
                      : 'error'
                }
              >
                {node.coverage}
              </Tag>
            )}
            {displayMode === 'uncovered' && node.uncoveredLines !== undefined && (
              <Tag
                type={
                  node.uncoveredLines === 0
                    ? 'success'
                    : node.uncoveredLines <= 10
                      ? 'warning'
                      : 'error'
                }
              >
                {node.uncoveredLines} line{node.uncoveredLines === 1 ? '' : 's'}
              </Tag>
            )}
          </FileTreeContent>
        </FileTreeItem>

        {node.isExpanded && node.children && (
          <div>{node.children.map(child => renderNode(child, nodePath))}</div>
        )}
      </div>
    );
  };

  return (
    <FileTreeContainer>
      <FileTreeHeader>
        <FileTreeHeaderLeft>
          File explorer
          {pathFilter && <FilterIndicator> • Filtered by "{pathFilter}"</FilterIndicator>}
        </FileTreeHeaderLeft>
        <FileTreeHeaderRight>
          <SegmentedControl
            size="xs"
            value={displayMode}
            onChange={(value: 'coverage' | 'uncovered') => onDisplayModeChange?.(value)}
          >
            <SegmentedControl.Item key="coverage">Coverage %</SegmentedControl.Item>
            <SegmentedControl.Item key="uncovered">Uncovered</SegmentedControl.Item>
          </SegmentedControl>
        </FileTreeHeaderRight>
      </FileTreeHeader>
      {nodes.map(node => renderNode(node))}
    </FileTreeContainer>
  );
}

// PathFilterResults component to show matching files in the right panel
interface PathFilterResultsProps {
  fileTree: FileTreeNode[];
  matchingFiles: FileTreeNode[];
  onFileSelect: (file: FileTreeNode) => void;
  pathFilter: string;
}

function PathFilterResults({
  matchingFiles,
  pathFilter,
  onFileSelect,
  fileTree,
}: PathFilterResultsProps) {
  if (matchingFiles.length === 0) {
    return (
      <SectionContent>
        <RightPanelHeader>No files found</RightPanelHeader>
        <RightPanelDescription>
          No files match the filter "{pathFilter}". Try adjusting your search term.
        </RightPanelDescription>
      </SectionContent>
    );
  }

  if (matchingFiles.length === 1) {
    // If only one file matches, show its uncovered lines directly
    return <UncoveredLinesTable fileData={matchingFiles[0]} fileTree={fileTree} />;
  }

  return (
    <SectionContent>
      <RightPanelHeader>
        Found {matchingFiles.length} files matching "{pathFilter}"
      </RightPanelHeader>
      <RightPanelDescription>
        Click on any file below to view its coverage details.
      </RightPanelDescription>
      <MatchingFilesList>
        {matchingFiles.map(file => (
          <MatchingFileItem key={file.id} onClick={() => onFileSelect(file)}>
            <MatchingFileIcon>
              <IconFile size="sm" color="gray300" />
            </MatchingFileIcon>
            <MatchingFileInfo>
              <MatchingFileName>{file.fullPath}</MatchingFileName>
              <MatchingFileStats>
                {file.coverage && <span>Coverage: {file.coverage}</span>}
                {file.uncoveredLines !== undefined && (
                  <span>
                    {file.uncoveredLines > 0
                      ? `${file.uncoveredLines} uncovered lines`
                      : 'Fully covered'}
                  </span>
                )}
              </MatchingFileStats>
            </MatchingFileInfo>
            {file.coverage && (
              <Tag
                type={
                  parseInt(file.coverage.replace('%', ''), 10) >= 80
                    ? 'success'
                    : parseInt(file.coverage.replace('%', ''), 10) >= 50
                      ? 'warning'
                      : 'error'
                }
              >
                {file.coverage}
              </Tag>
            )}
          </MatchingFileItem>
        ))}
      </MatchingFilesList>
    </SectionContent>
  );
}

export default function CommitsListPage() {
  const [selectedOrg, setSelectedOrg] = useState('turing-corp');
  const [selectedRepo, setSelectedRepo] = useState('enigma');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUploadFilters, setSelectedUploadFilters] = useState<string[]>([
    'completed',
    'pending',
  ]);
  const [pullRequestStatus, setPullRequestStatus] = useState('open');
  const [selectedCommitId, setSelectedCommitId] = useState(commitsData[0]?.id || '1');
  const [commitsSort, setCommitsSort] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(null);
  const [pullsSort, setPullsSort] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(null);
  const [isCommitDropdownOpen, setIsCommitDropdownOpen] = useState(false);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>(fileTreeData);
  const [selectedFileNode, setSelectedFileNode] = useState<FileTreeNode | null>(
    fileTreeData.find(node => node.id === 'src') || null
  );
  const [pathFilter, setPathFilter] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [originalPathFilter, setOriginalPathFilter] = useState('');
  const [displayMode, setDisplayMode] = useState<'coverage' | 'uncovered'>('coverage');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSunburstCollapsed, setIsSunburstCollapsed] = useState(false);
  const [showSunburstLabels, setShowSunburstLabels] = useState(false);
  const commitDropdownRef = useRef<HTMLDivElement>(null);
  const pathFilterRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMedia('(max-width: 768px)');

  // Sort handlers
  const handleCommitsSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setCommitsSort({field, order});
  }, []);

  const handlePullsSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setPullsSort({field, order});
  }, []);

  // Sort data functions
  const sortData = useCallback(
    (data: any[], sort: {field: string; order: 'asc' | 'desc'} | null) => {
      if (!sort) return data;

      return [...data].sort((a, b) => {
        let aValue = a[sort.field];
        let bValue = b[sort.field];

        // Handle different data types
        if (sort.field === 'commit' || sort.field === 'pullRequest') {
          // Sort by message/title for commit/pull request columns
          aValue = sort.field === 'commit' ? a.message : a.title;
          bValue = sort.field === 'commit' ? b.message : b.title;
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

  const sortedPullRequestsData = useMemo(() => {
    return sortData(pullRequestsData, pullsSort);
  }, [pullsSort, sortData]);

  // Get the selected commit data
  const selectedCommit =
    commitsData.find(commit => commit.id === selectedCommitId) || commitsData[0];

  // Handle click outside for commit dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        commitDropdownRef.current &&
        !commitDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCommitDropdownOpen(false);
      }
    }

    if (isCommitDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCommitDropdownOpen]);

  // Handle click outside for path filter suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pathFilterRef.current &&
        !pathFilterRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  const handleCommitSelect = (commitId: string) => {
    setSelectedCommitId(commitId);
    setIsCommitDropdownOpen(false);
  };

  // Calculate filtered lines count based on selected path
  const getFilteredLinesCount = () => {
    if (!selectedPath) {
      // Return total lines from all files in the tree
      const calculateTotalLines = (nodes: FileTreeNode[]): number => {
        let total = 0;
        nodes.forEach(node => {
          if (node.type === 'file') {
            // Mock line count based on coverage - in real app this would come from API
            const baseLines = Math.floor(Math.random() * 150) + 100; // 100-250 lines per file
            total += Math.floor(baseLines * 0.85); // 85% are tracked lines
          }
          if (node.children) {
            total += calculateTotalLines(node.children);
          }
        });
        return total;
      };
      return calculateTotalLines(fileTree);
    }

    // Count lines in files matching the selected path
    const calculateFilteredLines = (nodes: FileTreeNode[], path: string): number => {
      let total = 0;
      nodes.forEach(node => {
        const nodePath = getNodePath(node, nodes);
        if (nodePath.toLowerCase().includes(path.toLowerCase())) {
          if (node.type === 'file') {
            const baseLines = Math.floor(Math.random() * 150) + 100;
            total += Math.floor(baseLines * 0.85);
          }
        }
        if (node.children) {
          total += calculateFilteredLines(node.children, path);
        }
      });
      return total;
    };

    return calculateFilteredLines(fileTree, selectedPath);
  };

  // Helper function to get the full path of a node
  const getNodePath = (
    targetNode: FileTreeNode,
    _nodes: FileTreeNode[],
    _currentPath = ''
  ): string => {
    // Since we're now using full paths as IDs, we can just return the ID
    return targetNode.id;
  };

  // Get all file paths for auto-complete
  const getAllFilePaths = (): string[] => {
    const filePaths: string[] = [];

    const extractPaths = (nodes: FileTreeNode[], currentPath = ''): void => {
      nodes.forEach(node => {
        const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

        if (node.type === 'file') {
          filePaths.push(nodePath);
        }

        if (node.children) {
          extractPaths(node.children, nodePath);
        }
      });
    };

    extractPaths(fileTree);
    return filePaths;
  };

  // Get suggestions based on current input
  const getSuggestions = (input: string): string[] => {
    if (!input.trim()) return [];

    const allPaths = getAllFilePaths();
    const inputLower = input.toLowerCase();

    // Score and filter suggestions
    const scored = allPaths
      .map(path => {
        const pathLower = path.toLowerCase();
        let score = 0;

        // Exact match gets highest score
        if (pathLower === inputLower) score = 1000;
        // Starts with input gets high score
        else if (pathLower.startsWith(inputLower)) score = 500;
        // Contains input gets medium score
        else if (pathLower.includes(inputLower)) score = 100;
        // Filename matches get bonus points
        const fileName = path.split('/').pop()?.toLowerCase() || '';
        if (fileName.includes(inputLower)) score += 50;

        return {path, score};
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8) // Limit to 8 suggestions
      .map(item => item.path);

    return scored;
  };

  // Get all files that match the path filter
  const getMatchingFiles = (path: string): FileTreeNode[] => {
    const matchingFiles: FileTreeNode[] = [];

    const searchNodes = (nodes: FileTreeNode[], currentPath = ''): void => {
      nodes.forEach(node => {
        const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

        if (node.type === 'file' && nodePath.toLowerCase().includes(path.toLowerCase())) {
          matchingFiles.push({...node, fullPath: nodePath});
        }

        if (node.children) {
          searchNodes(node.children, nodePath);
        }
      });
    };

    searchNodes(fileTree);
    return matchingFiles;
  };

  // Get current suggestions
  const suggestions = getSuggestions(pathFilter);

  // Handle path filter input changes
  const handlePathFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPathFilter(value);
    setShowSuggestions(value.trim().length > 0);
    setSelectedSuggestionIndex(-1);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: string) => {
    setSelectedPath(suggestion);
    setPathFilter('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setSelectedFileNode(null);
  };

  // Handle path filter input
  const handlePathFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        // Select the highlighted suggestion
        selectSuggestion(suggestions[selectedSuggestionIndex]);
      } else if (pathFilter.trim()) {
        // Apply the typed filter
        setSelectedPath(pathFilter.trim());
        setPathFilter('');
        setShowSuggestions(false);
        setSelectedFileNode(null);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Handle file tree toggle
  const handleFileTreeToggle = useCallback((nodeId: string) => {
    const toggleNodeInTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return {...node, isExpanded: !node.isExpanded};
        }
        if (node.children) {
          return {...node, children: toggleNodeInTree(node.children)};
        }
        return node;
      });
    };

    setFileTree(prevTree => toggleNodeInTree(prevTree));
  }, []);

  // Handle sunburst chart node click
  const handleSunburstNodeClick = useCallback(
    (fullPath: string, isFile: boolean) => {
      // Function to find and expand all parent nodes leading to the target path
      const expandPathInTree = (
        nodes: FileTreeNode[],
        targetPath: string
      ): FileTreeNode[] => {
        return nodes.map(node => {
          // If this node is on the path to our target, expand it
          if (targetPath.startsWith(node.id) || targetPath === node.id) {
            const updatedNode = {...node, isExpanded: true};

            // If this node has children, recursively process them
            if (node.children) {
              updatedNode.children = expandPathInTree(node.children, targetPath);
            }

            return updatedNode;
          }

          // If this node has children, check if any child is on the target path
          if (node.children) {
            const hasTargetInChildren = node.children.some(
              child => targetPath.startsWith(child.id) || targetPath === child.id
            );

            if (hasTargetInChildren) {
              return {
                ...node,
                isExpanded: true,
                children: expandPathInTree(node.children, targetPath),
              };
            }
          }

          return node;
        });
      };

      // Function to find a node by its path
      const findNodeByPath = (
        nodes: FileTreeNode[],
        targetPath: string
      ): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.id === targetPath) {
            return node;
          }

          if (node.children) {
            const found = findNodeByPath(node.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      };

      // Update the file tree to expand all nodes leading to the clicked path
      setFileTree(prevTree => expandPathInTree(prevTree, fullPath));

      // If it's a file, select it; if it's a folder, just expand to show it
      if (isFile) {
        const targetNode = findNodeByPath(fileTree, fullPath);
        if (targetNode) {
          setSelectedFileNode(targetNode);
        }
      } else {
        // For folders, clear file selection but set path filter to show folder contents
        setSelectedFileNode(null);
        setSelectedPath(fullPath);
      }
    },
    [fileTree]
  );

  // Get initial tab from URL query parameter, default to 'commits'
  const initialTab = location.query?.tab || 'commits';
  const [activeTab, setActiveTab] = useState(
    tabOptions.some(tab => tab.id === initialTab) ? initialTab : 'commits'
  );

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

  // Filter pull requests by status
  const filteredPullRequests = useMemo(() => {
    const filtered = sortedPullRequestsData.filter(pr => pr.status === pullRequestStatus);
    return filtered;
  }, [pullRequestStatus, sortedPullRequestsData]);

  // Pull request status counts
  const pullRequestCounts = useMemo(() => {
    const counts = {open: 0, merged: 0, closed: 0};
    pullRequestsData.forEach(pr => {
      counts[pr.status as keyof typeof counts]++;
    });
    return counts;
  }, []);

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
                      <IconBuilding />
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
      </ControlsContainer>

      <TabNavigationContainer>
        <TabsList>
          {tabOptions.map(tab => (
            <TabItem
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                navigate({
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    tab: tab.id,
                  },
                });
              }}
            >
              <TabLabel isActive={activeTab === tab.id}>{tab.label}</TabLabel>
              <TabIndicator isActive={activeTab === tab.id} />
            </TabItem>
          ))}
        </TabsList>
      </TabNavigationContainer>

      {activeTab === 'commits' && (
        <CommitsSection>
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
      )}

      {activeTab === 'pulls' && (
        <PullsSection>
          <GridEditable
            aria-label={t('Pull Requests Table')}
            isLoading={false}
            data={filteredPullRequests}
            columnOrder={PULLS_COLUMN_ORDER}
            columnSortBy={
              pullsSort ? [{key: pullsSort.field, order: pullsSort.order}] : []
            }
            grid={{
              renderHeadCell: (column: GridColumnOrder) =>
                renderPullsTableHeader(
                  column,
                  pullRequestCounts,
                  pullRequestStatus,
                  setPullRequestStatus,
                  pullsSort,
                  handlePullsSortChange,
                  location
                ),
              renderBodyCell: renderPullsTableBody,
            }}
          />
        </PullsSection>
      )}

      {activeTab === 'fileExplorer' && (
        <FileExplorerSection>
          <FileExplorerHeader>
            <CommitSelectorGroup>
              <SelectorLabel>Coverage based on the selected commit</SelectorLabel>
              <CommitSelectorDropdown ref={commitDropdownRef}>
                <CommitSelectorButton
                  onClick={() => setIsCommitDropdownOpen(!isCommitDropdownOpen)}
                >
                  <UserAvatar user={selectedCommit?.authorUser} size={16} gravatar />
                  <CommitSelectorText>
                    {selectedCommit?.author} committed {selectedCommit?.hash} •{' '}
                    {selectedCommit?.timestamp}
                  </CommitSelectorText>
                  <IconChevron
                    direction={isCommitDropdownOpen ? 'up' : 'down'}
                    size="xs"
                  />
                </CommitSelectorButton>
                {isCommitDropdownOpen && (
                  <CommitDropdownMenu>
                    {commitsData.slice(0, 8).map(commit => (
                      <CommitDropdownItem
                        key={commit.id}
                        onClick={() => handleCommitSelect(commit.id)}
                        $isSelected={commit.id === selectedCommitId}
                      >
                        <UserAvatar user={commit.authorUser} size={16} gravatar />
                        <CommitDropdownText>
                          <CommitDropdownMessage>{commit.message}</CommitDropdownMessage>
                          <CommitDropdownDetails>
                            {commit.author} committed {commit.hash} • {commit.timestamp}
                          </CommitDropdownDetails>
                        </CommitDropdownText>
                        <Tooltip
                          title={
                            <div>
                              <strong>Patch Coverage: {commit.coverage}</strong>
                            </div>
                          }
                          position="top"
                        >
                          <CommitCoverageTag>{commit.coverage}</CommitCoverageTag>
                        </Tooltip>
                      </CommitDropdownItem>
                    ))}
                  </CommitDropdownMenu>
                )}
              </CommitSelectorDropdown>
            </CommitSelectorGroup>
            <ViewCommitButton>
              <IconCommit size="sm" />
              View commit details
            </ViewCommitButton>
          </FileExplorerHeader>

          <SummaryContainer columns={12}>
            <SelectedCommitPanel>
              <PanelHeader>{t('Coverage On The Selected Commit')}</PanelHeader>
              <PanelBody>
                <SummaryEntries largeColumnSpan={2} smallColumnSpan={2}>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      body={
                        // repo coverage tooltip
                        <p>
                          {t(
                            'The percentage of lines covered by tests across the entire repository.'
                          )}
                        </p>
                      }
                    >
                      {t('Repository coverage')}
                    </SummaryEntryLabel>
                    <SummaryValueContainer>
                      <SummaryEntryValue>98.98%</SummaryEntryValue>
                      <Tag type="success">+4.25%</Tag>
                    </SummaryValueContainer>
                    <StyledSubText>
                      {t('Head commit')}{' '}
                      <Link to={`/codecov/coverage/commits/${headCommit.sha}`}>
                        {headCommit.shortSha}
                      </Link>
                    </StyledSubText>
                  </SummaryEntry>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      // patch coverage tooltip
                      body={
                        <p>
                          {t(
                            'The test coverage for lines changed in a pull request or commit, ensuring new code is tested before merging.'
                          )}
                        </p>
                      }
                    >
                      {t('Patch coverage')}
                    </SummaryEntryLabel>
                    <SummaryEntryValue>100%</SummaryEntryValue>
                  </SummaryEntry>
                </SummaryEntries>
              </PanelBody>
            </SelectedCommitPanel>
            <SecondSelectedCommitPanel>
              <PanelHeader>{t('View the 1.02% of uncovered lines')}</PanelHeader>
              <PanelBody>
                <SummaryEntries largeColumnSpan={3} smallColumnSpan={2}>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      // uncovered lines tooltip
                      body={<p>{t('Uncovered lines tooltip')}</p>}
                    >
                      {t('Uncovered lines')}
                    </SummaryEntryLabel>
                    <SummaryEntryValueLink filterBy="uncoveredLines">
                      204
                    </SummaryEntryValueLink>
                  </SummaryEntry>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      // Covered lines tooltip
                      body={
                        <p>
                          {t(
                            'Files that were directly modified in a pull request or commit—these are the files where actual code changes were made.'
                          )}
                        </p>
                      }
                    >
                      {t('Covered Lines')}
                    </SummaryEntryLabel>
                    <SummaryEntryValue>19,796</SummaryEntryValue>
                  </SummaryEntry>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      // Total Lines tooltip
                      body={
                        <p>
                          {t(
                            'Changes that originated from other files in the same commit—these files did not have changes in this PR.'
                          )}
                          <ExternalLink
                            href="https://docs.codecov.com/docs/coverage-on-indirect-changes"
                            style={{marginLeft: '4px'}}
                          >
                            {t('View list of indirect changes.')}
                          </ExternalLink>
                        </p>
                      }
                    >
                      {t('Total Lines')}
                    </SummaryEntryLabel>
                    <SummaryEntryValue>20,000</SummaryEntryValue>
                  </SummaryEntry>
                </SummaryEntries>
              </PanelBody>
            </SecondSelectedCommitPanel>
            <UploadsPanel>
              <PanelHeader>{t('Coverage Uploads - %s', headCommit.shortSha)}</PanelHeader>
              <PanelBody>
                <SummaryEntries largeColumnSpan={1} smallColumnSpan={1}>
                  <SummaryEntry>
                    <SummaryEntryLabel
                      showUnderline
                      body={<p>{t('Uploads count tooltip')}</p>}
                    >
                      {t('Uploads count')}
                    </SummaryEntryLabel>
                    <UploadsCountLink>65</UploadsCountLink>
                    <StatusIndicatorContainer>
                      <StatusItem>
                        <StatusDot $variant="success" />
                        <StatusText>65 Processed</StatusText>
                      </StatusItem>
                      <StatusItem>
                        <StatusDot $variant="warning" />
                        <StatusText>15 Pending</StatusText>
                      </StatusItem>
                      <StatusItem>
                        <StatusDot $variant="error" />
                        <StatusText>1 Failed</StatusText>
                      </StatusItem>
                    </StatusIndicatorContainer>
                  </SummaryEntry>
                </SummaryEntries>
              </PanelBody>
            </UploadsPanel>
          </SummaryContainer>

          <SunburstChartContainer>
            <SunburstChartHeader>
              <SunburstChartHeaderLeft>
                <SunburstToggleButton
                  onClick={() => setIsSunburstCollapsed(!isSunburstCollapsed)}
                  aria-label={
                    isSunburstCollapsed
                      ? 'Expand sunburst chart'
                      : 'Collapse sunburst chart'
                  }
                >
                  <IconChevron
                    direction={isSunburstCollapsed ? 'right' : 'down'}
                    size="sm"
                  />
                </SunburstToggleButton>
                <SunburstChartHeaderContent>
                  <SunburstChartTitle>Coverage Visualization</SunburstChartTitle>
                  <SunburstChartDescription>
                    Interactive sunburst chart showing file and folder coverage hierarchy.
                    Click on segments to navigate the file tree.
                  </SunburstChartDescription>
                </SunburstChartHeaderContent>
              </SunburstChartHeaderLeft>
              {!isSunburstCollapsed && (
                <SunburstChartHeaderRight>
                  <SunburstLabelToggle>
                    <SunburstCheckboxInput
                      type="checkbox"
                      id="sunburst-labels-toggle"
                      checked={showSunburstLabels}
                      onChange={e => setShowSunburstLabels(e.target.checked)}
                    />
                    <SunburstCheckboxLabel htmlFor="sunburst-labels-toggle">
                      Show Labels
                    </SunburstCheckboxLabel>
                  </SunburstLabelToggle>
                </SunburstChartHeaderRight>
              )}
            </SunburstChartHeader>
            {!isSunburstCollapsed && (
              <SunburstChartContent>
                <TreeCoverageSunburstChart
                  data={sunburstData}
                  onNodeClick={handleSunburstNodeClick}
                  showLabels={showSunburstLabels}
                />
              </SunburstChartContent>
            )}
          </SunburstChartContainer>

          <PathFilterContainer>
            <PathFilterGroup>
              <PathFilter>Path filter</PathFilter>
              <PathFilterSearchContainer ref={pathFilterRef}>
                <PathFilterSearchBar>
                  <SearchIconContainer>
                    <IconSearch size="sm" />
                  </SearchIconContainer>
                  {selectedPath && (
                    <PathToken>
                      <PathTokenText>{selectedPath}</PathTokenText>
                      <PathTokenClose
                        onClick={() => {
                          setSelectedPath('');
                          setSelectedFileNode(null);
                        }}
                      >
                        <IconClose size="xs" />
                      </PathTokenClose>
                    </PathToken>
                  )}
                  <PathFilterInput
                    type="text"
                    placeholder={selectedPath ? '' : 'Type to search files...'}
                    value={pathFilter}
                    onChange={handlePathFilterChange}
                    onKeyDown={handlePathFilterKeyDown}
                    onFocus={() => {
                      if (pathFilter.trim()) {
                        setShowSuggestions(true);
                      }
                    }}
                  />
                </PathFilterSearchBar>
                {showSuggestions && suggestions.length > 0 && (
                  <SuggestionsDropdown>
                    {suggestions.map((suggestion, index) => (
                      <SuggestionItem
                        key={suggestion}
                        $isSelected={index === selectedSuggestionIndex}
                        onClick={() => selectSuggestion(suggestion)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        <SuggestionIcon>
                          <IconFile size="sm" color="gray300" />
                        </SuggestionIcon>
                        <SuggestionPath>{suggestion}</SuggestionPath>
                      </SuggestionItem>
                    ))}
                  </SuggestionsDropdown>
                )}
              </PathFilterSearchContainer>
            </PathFilterGroup>
            <PathFilterResultsText>{getFilteredLinesCount()} lines</PathFilterResultsText>
          </PathFilterContainer>

          {isMobile ? (
            <MobileFileExplorerContent>
              <ResizableLeftPanel>
                <FileTree
                  nodes={fileTree}
                  onToggle={handleFileTreeToggle}
                  selectedNode={selectedFileNode}
                  onNodeSelect={setSelectedFileNode}
                  displayMode={displayMode}
                  onDisplayModeChange={setDisplayMode}
                  pathFilter={selectedPath}
                  matchingFiles={selectedPath ? getMatchingFiles(selectedPath) : []}
                />
              </ResizableLeftPanel>
              <ResizableRightPanel>
                {selectedFileNode ? (
                  <UncoveredLinesTable
                    fileData={selectedFileNode}
                    fileTree={fileTree}
                    onBackToResults={
                      originalPathFilter
                        ? () => {
                            setSelectedPath(originalPathFilter);
                            setSelectedFileNode(null);
                            setOriginalPathFilter('');
                          }
                        : undefined
                    }
                    pathFilter={originalPathFilter}
                  />
                ) : selectedPath ? (
                  <PathFilterResults
                    fileTree={fileTree}
                    matchingFiles={getMatchingFiles(selectedPath)}
                    onFileSelect={file => {
                      setSelectedFileNode(file);
                      setOriginalPathFilter(selectedPath); // Store the original path filter
                      setSelectedPath(''); // Clear the path filter to show coverage details
                    }}
                    pathFilter={selectedPath}
                  />
                ) : (
                  <SectionContent>
                    <RightPanelHeader>Coverage Information</RightPanelHeader>
                    <RightPanelDescription>
                      Select a file or folder from the explorer to view coverage details,
                      or use the path filter to find specific files.
                    </RightPanelDescription>
                    <RightPanelFeatures>
                      <FeatureItem>
                        <strong>Files:</strong> View uncovered lines and detailed code
                        coverage
                      </FeatureItem>
                      <FeatureItem>
                        <strong>Folders:</strong> View uncovered lines from all files
                        within the folder
                      </FeatureItem>
                      <FeatureItem>
                        <strong>Path Filter:</strong> Type a path and press Enter to find
                        matching files
                      </FeatureItem>
                    </RightPanelFeatures>
                  </SectionContent>
                )}
              </ResizableRightPanel>
            </MobileFileExplorerContent>
          ) : (
            <SplitPanel
              availableSize={window.innerWidth - 64} // Account for padding/margins
              left={{
                content: (
                  <ResizableLeftPanel>
                    <FileTree
                      nodes={fileTree}
                      onToggle={handleFileTreeToggle}
                      selectedNode={selectedFileNode}
                      onNodeSelect={setSelectedFileNode}
                      displayMode={displayMode}
                      onDisplayModeChange={setDisplayMode}
                      pathFilter={selectedPath}
                      matchingFiles={selectedPath ? getMatchingFiles(selectedPath) : []}
                    />
                  </ResizableLeftPanel>
                ),
                default: 350,
                min: 200,
                max: 600,
              }}
              right={
                <ResizableRightPanel>
                  {selectedFileNode ? (
                    <UncoveredLinesTable
                      fileData={selectedFileNode}
                      fileTree={fileTree}
                      onBackToResults={
                        originalPathFilter
                          ? () => {
                              setSelectedPath(originalPathFilter);
                              setSelectedFileNode(null);
                              setOriginalPathFilter('');
                            }
                          : undefined
                      }
                      pathFilter={originalPathFilter}
                    />
                  ) : selectedPath ? (
                    <PathFilterResults
                      fileTree={fileTree}
                      matchingFiles={getMatchingFiles(selectedPath)}
                      onFileSelect={file => {
                        setSelectedFileNode(file);
                        setOriginalPathFilter(selectedPath); // Store the original path filter
                        setSelectedPath(''); // Clear the path filter to show coverage details
                      }}
                      pathFilter={selectedPath}
                    />
                  ) : (
                    <SectionContent>
                      <RightPanelHeader>Coverage Information</RightPanelHeader>
                      <RightPanelDescription>
                        Select a file or folder from the explorer to view coverage
                        details, or use the path filter to find specific files.
                      </RightPanelDescription>
                      <RightPanelFeatures>
                        <FeatureItem>
                          <strong>Files:</strong> View uncovered lines and detailed code
                          coverage
                        </FeatureItem>
                        <FeatureItem>
                          <strong>Folders:</strong> View uncovered lines from all files
                          within the folder
                        </FeatureItem>
                        <FeatureItem>
                          <strong>Path Filter:</strong> Type a path and press Enter to
                          find matching files
                        </FeatureItem>
                      </RightPanelFeatures>
                    </SectionContent>
                  )}
                </ResizableRightPanel>
              }
              sizeStorageKey="codecov-filetree-width"
            />
          )}
        </FileExplorerSection>
      )}

      {activeTab === 'coverageTrend' && (
        <CoverageTrendSection>
          <CoverageTrendPage />
        </CoverageTrendSection>
      )}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-wrap: wrap;
  align-items: center;

  /* Mobile responsive adjustments */
  @media (max-width: 767px) {
    gap: ${p => p.theme.space.md};
    flex-direction: column;
    align-items: stretch;
  }

  @media (max-width: 1023px) {
    gap: ${p => p.theme.space.lg};
  }
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
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.dropdown};
  min-width: 200px;
  margin-top: ${p => p.theme.space.xs};
`;

const TabNavigationContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 0 ${p => p.theme.space['2xl']};
`;

const TabsList = styled('div')`
  display: flex;
`;

const TabItem = styled('button')<{isActive: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.xs};
  padding: 0 ${p => p.theme.space.md};
  border: none;
  background: none;
  cursor: pointer;
  position: relative;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const TabLabel = styled('span')<{isActive: boolean}>`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.143;
  text-align: center;
  padding: ${p => p.theme.space.md} 0;
  color: ${p => (p.isActive ? p.theme.active : p.theme.textColor)};
`;

const TabIndicator = styled('div')<{isActive: boolean}>`
  width: 100%;
  height: 3px;
  background: ${p => (p.isActive ? p.theme.purple300 : 'transparent')};
  position: absolute;
  bottom: 0;
`;

const CommitsSection = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const PullsSection = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const FileExplorerSection = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const CoverageTrendSection = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const SectionContent = styled('div')`
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const SearchBarContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  flex: 1;
  height: 40px;
  min-width: 200px;
  max-width: 100%;

  /* Responsive breakpoints */
  @media (min-width: 768px) {
    max-width: 400px;
  }

  @media (min-width: 1024px) {
    max-width: 500px;
  }

  @media (min-width: 1280px) {
    max-width: 100%;
  }

  /* Mobile adjustments */
  @media (max-width: 767px) {
    padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
    gap: ${p => p.theme.space.sm};
    min-width: 150px;
  }
`;

const SearchInput = styled('input')`
  border: none;
  background: none;
  outline: none;
  flex: 1;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.667;
  color: ${p => p.theme.textColor};

  &::placeholder {
    color: ${p => p.theme.subText};
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

// Table-specific styled components
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

const PullRequestLink = styled('a')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.linkColor};
  text-decoration: none;
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
  align-items: center;
  gap: ${p => p.theme.space.md};
  width: 300px;
`;

const UploadStatus = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
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

const PullRequestHeaderContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 50%;
  gap: ${p => p.theme.space.md};
`;

const PullRequestTitleRow = styled('div')`
  display: flex;
  align-items: center;
`;

const PullRequestControlRow = styled('div')`
  display: flex;
  align-items: center;
`;

const FileExplorerHeader = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${p => p.theme.space.lg};
  }
`;

const CommitSelectorGroup = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.lg};
`;

const SelectorLabel = styled('label')`
  font-family: ${p => p.theme.text.family};
  font-weight: 600;
  font-size: 16px;
  line-height: 1.4;
  color: ${p => p.theme.headingColor};
  margin-top: 8px;
`;

const CommitSelectorDropdown = styled('div')`
  position: relative;
`;

const CommitSelectorButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  transition: all 0.15s ease;
  width: 357px;
  height: 38px;
  box-shadow: inset 0px 1px 4px 0px rgba(43, 34, 51, 0.04);

  &:hover {
    border-color: ${p => p.theme.gray300};
    background: ${p => p.theme.backgroundSecondary};
  }

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }
`;

const CommitSelectorText = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-weight: 400;
  font-size: 14px;
  line-height: 1em;
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: left;
`;

const ViewCommitButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.sm};
  padding: 0 ${p => p.theme.space.lg};
  height: 38px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: ${p => p.theme.text.family};
  font-weight: 500;
  font-size: 14px;
  line-height: 1.14;
  color: ${p => p.theme.textColor};
  box-shadow: 0px 1px 2px 0px rgba(43, 34, 51, 0.04);

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
    border-color: ${p => p.theme.gray300};
  }

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }

  &:active {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const CommitDropdownMenu = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.dropdown};
  margin-top: ${p => p.theme.space.xs};
  max-height: 320px;
  overflow-y: auto;
`;

const CommitDropdownItem = styled('div')<{$isSelected: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  cursor: pointer;
  transition: background-color 0.15s ease;
  background: ${p => (p.$isSelected ? p.theme.backgroundSecondary : 'transparent')};
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const CommitDropdownText = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const CommitDropdownMessage = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CommitDropdownDetails = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
  margin-top: ${p => p.theme.space.xs};
`;

const CommitCoverageTag = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  white-space: nowrap;
`;

// File Explorer specific styled components (legacy panels removed, now using resizable SplitPanel)

// Resizable panel styled components
const ResizableLeftPanel = styled('div')`
  height: 100%;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  min-height: 500px;
`;

const ResizableRightPanel = styled('div')`
  height: 100%;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.lg};
  min-height: 500px;
  overflow: auto;
`;

// Mobile-specific layout that stacks panels vertically
const MobileFileExplorerContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  min-height: 500px;
`;

// FileTree styled components
const FileTreeContainer = styled('div')`
  /* Header has its own padding, body needs left padding for alignment */
  > *:not(:first-child) {
    padding-left: 4px;
  }
`;

const FileTreeHeader = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  font-family: ${p => p.theme.text.family};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FileTreeHeaderLeft = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FileTreeHeaderRight = styled('div')`
  display: flex;
  align-items: center;
`;

const FileTreeItem = styled('div')<{
  $level: number;
  $isFiltered?: boolean;
  $isSelected?: boolean;
}>`
  display: flex;
  align-items: center;
  position: relative;
  background: ${p =>
    p.$isSelected
      ? p.theme.purple100
      : p.$isFiltered
        ? p.theme.yellow100
        : 'transparent'};

  &:hover {
    background: ${p => (p.$isSelected ? p.theme.purple200 : p.theme.backgroundSecondary)};
  }
`;

const FileTreeContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
  width: 100%;
  min-height: 32px;
  cursor: pointer;
`;

const FileTreeToggle = styled('div')`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FileTreeChevron = styled('button')<{$isExpanded: boolean}>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  transition: color 0.15s ease;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const FileTreeIcon = styled('div')`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FolderIcon = styled('div')<{$isExpanded: boolean}>`
  width: 14px;
  height: 12px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    width: 14px;
    height: 10px;
    background: ${p => (p.$isExpanded ? p.theme.purple400 : p.theme.gray300)};
    border-radius: 2px;
    top: 2px;
  }

  &::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 2px;
    background: ${p => (p.$isExpanded ? p.theme.purple400 : p.theme.gray300)};
    border-radius: 1px 1px 0 0;
    top: 0;
    left: 0;
  }
`;

const FileTreeName = styled('span')<{$isHighlighted?: boolean}>`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p =>
    p.$isHighlighted ? p.theme.fontWeight.bold : p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  color: ${p => (p.$isHighlighted ? p.theme.purple400 : p.theme.textColor)};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Right Panel styled components
const RightPanelHeader = styled('h3')`
  margin: 0 0 ${p => p.theme.space.lg};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const RightPanelDescription = styled('p')`
  margin: 0 0 ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const RightPanelFeatures = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const FeatureItem = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

// UncoveredLinesTable styled components
const UncoveredLinesPanel = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  overflow: hidden;
`;

const TableTitle = styled('h3')`
  margin: 0;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: ${p => p.theme.text.lineHeightHeading};
  letter-spacing: -0.64%;
  color: ${p => p.theme.headingColor};
`;

const TableContainer = styled('div')`
  overflow: hidden;
`;

const TableHeaderRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 132px 102px;
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SortableFilePathHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? p.theme.headingColor : p.theme.subText)};
  border-right: 1px solid ${p => p.theme.border};
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: ${p => p.theme.headingColor};
  }
`;

const ToggleAllButton = styled('button')`
  display: flex;
  align-items: center;
  background: none;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 500;
  color: ${p => p.theme.subText};
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: capitalize;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
    color: ${p => p.theme.headingColor};
    border-color: ${p => p.theme.subText};
  }

  &:active {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const FilePathLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
`;

const SortableCoverageHeader = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  line-height: 1em;
  text-transform: uppercase;
  color: ${p => (p.isActive ? p.theme.headingColor : p.theme.subText)};
  border-right: 1px solid ${p => p.theme.border};
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;

  &:hover {
    color: ${p => p.theme.headingColor};
  }

  &:last-child {
    border-right: none;
  }
`;

const SortIcon = styled(IconArrow)<{$isActive: boolean}>`
  opacity: ${p => (p.$isActive ? 0.8 : 0)};
  transition: opacity 0.15s ease;

  ${SortableCoverageHeader}:hover &,
  ${SortableFilePathHeader}:hover & {
    opacity: 0.8;
  }
`;

const TableRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 132px 132px 102px;
  background: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const FilePathCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  cursor: pointer;
  border-right: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
`;

const ChevronIcon = styled(IconChevron)<{isExpanded: boolean}>`
  flex-shrink: 0;
  width: ${p => p.theme.space.xl};
  height: ${p => p.theme.space.xl};
  transition: transform 0.15s ease;
  transform: rotate(${p => (p.isExpanded ? '0deg' : '90deg')});
  color: ${p => p.theme.headingColor};
`;

const FilePath = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
  flex: 1;
  word-break: break-all;
`;

const UncoveredLinesCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.headingColor};
  border-right: 1px solid ${p => p.theme.border};
`;

const CoverageCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.headingColor};
  background: ${p => p.theme.background};
  border-right: 1px solid ${p => p.theme.border};

  &:last-child {
    border-right: none;
  }
`;

const ExpandedRow = styled('div')`
  grid-column: 1 / -1;
  background: ${p => p.theme.backgroundTertiary};
  border-bottom: 1px solid ${p => p.theme.border};

  &:last-child {
    border-bottom: none;
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }
`;

const ExpandedContent = styled('div')`
  padding: ${p => p.theme.space.lg};
`;

const DiffSection = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 0;
  margin-bottom: ${p => p.theme.space.xl};
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DiffHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const DiffHeaderText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

const DiffHeaderActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};

  svg {
    width: ${p => p.theme.fontSize.sm};
    height: ${p => p.theme.fontSize.sm};
    color: ${p => p.theme.subText};
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
`;

const CodeBlock = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  background: ${p => p.theme.background};
`;

const CodeLine = styled('div')<{lineType: CoverageType}>`
  display: flex;
  align-items: stretch;
  background: ${p => {
    switch (p.lineType) {
      case 'covered':
        return p.theme.green100;
      case 'uncovered':
        return p.theme.red100;
      case 'partially-covered':
        return p.theme.yellow100;
      default:
        return p.theme.background;
    }
  }};
`;

const LineNumber = styled('div')<{lineType: CoverageType}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: auto;
  min-width: 40px;
  padding: 0;
  text-align: right;
  color: ${p => p.theme.textColor};
  background: ${p => {
    switch (p.lineType) {
      case 'covered':
        return p.theme.green100;
      case 'uncovered':
        return p.theme.red100;
      case 'partially-covered':
        return p.theme.yellow100;
      default:
        return p.theme.background;
    }
  }};
  border-right: ${p => {
    switch (p.lineType) {
      case 'covered':
        return `2px solid ${p.theme.green300}`;
      case 'uncovered':
        return `2px solid ${p.theme.red300}`;
      case 'partially-covered':
        return `2px solid ${p.theme.yellow300}`;
      default:
        return `2px solid ${p.theme.border}`;
    }
  }};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: 2;
`;

const CodeContent = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${p => p.theme.space.md};
  padding: 0 ${p => p.theme.space.lg};
  flex: 1;
`;

const CodeText = styled('span')<{lineType?: CoverageType}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => (p.lineType === 'uncovered' ? '425' : p.theme.fontWeight.normal)};
  line-height: 2;
  color: ${p => p.theme.textColor};
  flex: 1;
`;

const TableTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.xl};
  gap: ${p => p.theme.space.lg};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${p => p.theme.space.md};
  }
`;

const InlineLegendContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const InlineLegendTitle = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;

const LegendItems = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
`;

const LegendItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const LegendColorBox = styled('div')<{$color: 'green' | 'orange' | 'red'}>`
  width: 16px;
  height: 16px;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => {
    switch (p.$color) {
      case 'green':
        return p.theme.green100;
      case 'orange':
        return p.theme.yellow100;
      case 'red':
        return p.theme.red100;
      default:
        return p.theme.background;
    }
  }};
  border: ${p => {
    switch (p.$color) {
      case 'green':
        return `1px solid ${p.theme.green300}`;
      case 'orange':
        return `1px solid ${p.theme.yellow300}`;
      case 'red':
        return `1px solid ${p.theme.red300}`;
      default:
        return `1px solid ${p.theme.border}`;
    }
  }};
`;

const LegendLabel = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
`;

// Summary Container styled components
const SummaryValueContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const StatusIndicatorContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatusItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusDot = styled('div')<{$variant: 'success' | 'warning' | 'error'}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${p => {
    switch (p.$variant) {
      case 'success':
        return p.theme.green300;
      case 'warning':
        return p.theme.yellow300;
      case 'error':
        return p.theme.red300;
      default:
        return p.theme.gray300;
    }
  }};
  flex-shrink: 0;
`;

const StatusText = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: 1.2;
  color: ${p => p.theme.subText};
`;

const StyledSubText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const SelectedCommitPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 4;
  }
`;

const SecondSelectedCommitPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 5;
  }
`;

const UploadsPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 3;
  }
`;

// Path Filter styled components
const PathFilterContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${p => p.theme.space.md};
  }
`;

const PathFilterGroup = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 100%;
`;

const PathFilter = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${p => p.theme.space.lg};
  height: 40px;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.family};
  font-weight: 500;
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.143;
  color: ${p => p.theme.textColor};
  white-space: nowrap;
`;

const PathFilterSearchContainer = styled('div')`
  flex: 1;
  max-width: 100%;
  position: relative;
`;

const PathFilterSearchBar = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: 9px ${p => p.theme.space.md};
  height: 40px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-left: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }
`;

const SearchIconContainer = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  flex-shrink: 0;
`;

const PathToken = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs};
  background: rgba(210, 223, 247, 0.5);
  border: 1px solid #d2dff7;
  border-radius: ${p => p.theme.borderRadius};
  flex-shrink: 0;
`;

const PathTokenText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-weight: 500;
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1em;
  color: ${p => p.theme.textColor};
`;

const PathTokenClose = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: #80708f;
  padding: 0;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const PathFilterInput = styled('input')`
  border: none;
  background: none;
  outline: none;
  flex: 1;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.143;
  color: ${p => p.theme.textColor};
  min-width: 0;

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const PathFilterResultsText = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: 500;
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
  flex-shrink: 0;
`;

// Filter indicator styled component
const FilterIndicator = styled('span')`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.purple400};
`;

// Matching files list styled components
const MatchingFilesList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.lg};
`;

const MatchingFileItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
    border-color: ${p => p.theme.purple300};
  }
`;

const MatchingFileIcon = styled('div')`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MatchingFileInfo = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const MatchingFileName = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MatchingFileStats = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  color: ${p => p.theme.subText};
  display: flex;
  gap: ${p => p.theme.space.lg};

  span {
    white-space: nowrap;
  }
`;

// Auto-complete suggestions styled components
const SuggestionsDropdown = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.dropdown};
  margin-top: ${p => p.theme.space.xs};
  max-height: 320px;
  overflow-y: auto;
`;

const SuggestionItem = styled('div')<{$isSelected: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  cursor: pointer;
  transition: background-color 0.15s ease;
  background: ${p => (p.$isSelected ? p.theme.backgroundSecondary : 'transparent')};
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const SuggestionIcon = styled('div')`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SuggestionPath = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Sunburst Chart styled components
const SunburstChartContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  margin-bottom: ${p => p.theme.space.xl};
`;

const SunburstChartHeader = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

const SunburstChartHeaderLeft = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
`;

const SunburstToggleButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.subText};
  transition: all 0.15s ease;
  flex-shrink: 0;
  margin-top: 2px;

  &:hover {
    background: ${p => p.theme.backgroundTertiary};
    color: ${p => p.theme.textColor};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.purple300};
  }
`;

const SunburstChartHeaderContent = styled('div')`
  flex: 1;
  min-width: 0;
`;

const SunburstChartTitle = styled('h3')`
  margin: 0 0 ${p => p.theme.space.sm};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const SunburstChartDescription = styled('p')`
  margin: 0;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const SunburstChartContent = styled('div')`
  padding: ${p => p.theme.space.lg};
`;

const SunburstChartHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 2px;
`;

// Custom component for uploads count link that opens history page in new tab
function UploadsCountLink({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  // Use a default commit hash since this is a mock component
  const commitHash = headCommit.shortSha;

  const historyPath = makeCodecovPathname({
    organization,
    path: `/${COVERAGE_BASE_URL}/commits/${commitHash}/history/`,
  });

  return (
    <UploadsCountContainer>
      <IconOpen />
      <a href={historyPath} target="_blank" rel="noopener noreferrer">
        <StyledUploadsCountLink>{children}</StyledUploadsCountLink>
      </a>
    </UploadsCountContainer>
  );
}

const UploadsCountContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const StyledUploadsCountLink = styled('span')`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.linkColor};
  font-size: 2.25rem;

  /* This stops the text from jumping when becoming bold */
  &::after {
    content: attr(data-text);
    height: 0;
    visibility: hidden;
    overflow: hidden;
    pointer-events: none;
    font-weight: ${p => p.theme.fontWeight.bold};
    display: block;
  }

  &:hover {
    text-decoration: underline;
  }
`;

const SunburstLabelToggle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const SunburstCheckboxInput = styled('input')`
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${p => p.theme.purple400};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.purple300};
    border-radius: 2px;
  }
`;

const SunburstCheckboxLabel = styled('label')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.textColor};
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${p => p.theme.headingColor};
  }
`;
