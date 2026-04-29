import {createContext, useContext} from 'react';

import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './main/imageDisplay/diffImageDisplay';

export type ViewMode = 'single' | 'list';
export type SortBy = 'diff' | 'alpha';

interface SnapshotViewerContextValue {
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  diffImageBaseUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  isSoloView: boolean;
  listItems: SidebarItem[];
  onDiffModeChange: (mode: DiffMode) => void;
  onNavigateSingleView: (direction: 'prev' | 'next') => void;
  onOpenSnapshot: (key: string) => void;
  onOverlayColorChange: (color: string) => void;
  onSelectSnapshot: (key: string | null) => void;
  onSortByChange: (sort: SortBy) => void;
  onToggleSoloView: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  overlayColor: string;
  selectedItem: SidebarItem | null;
  selectedSnapshotKey: string | null;
  sortBy: SortBy;
  variantIndex: number;
  viewMode: ViewMode;
  comparisonType?: 'diff' | 'solo';
  headBranch?: string | null;
}

const SnapshotViewerContext = createContext<SnapshotViewerContextValue | null>(null);

export const SnapshotViewerProvider = SnapshotViewerContext.Provider;

export function useSnapshotViewer(): SnapshotViewerContextValue {
  const ctx = useContext(SnapshotViewerContext);
  if (!ctx) {
    throw new Error('useSnapshotViewer must be used within a SnapshotViewerProvider');
  }
  return ctx;
}
