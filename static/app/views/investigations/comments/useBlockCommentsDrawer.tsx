import {useCallback, useEffect, useRef} from 'react';
import {useQueryStates} from 'nuqs';

import {useOnClickOutside} from '@sentry/scraps/useOnClickOutside';

import {useDrawer} from 'sentry/components/drawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {BlockCommentsDrawer} from 'sentry/views/investigations/comments/blockCommentsDrawer';
import {COMMENTS_DRAWER_PARSERS} from 'sentry/views/investigations/comments/utils';
import {getBlockElementId} from 'sentry/views/investigations/detail/block';

/**
 * A block's comments open in a drawer while `?comments=open&commentsBlock=<id>`
 * is in the URL, so links can open it directly. Opening and closing only change
 * the URL.
 */
export function useBlockCommentsDrawer(investigationId: string) {
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen, panelRef} = useDrawer();
  const {pathname} = useLocation();
  const [{comments, commentsBlock}, setDrawerQuery] = useQueryStates(
    COMMENTS_DRAWER_PARSERS
  );
  const isOpenInUrl = comments === 'open' && !!commentsBlock;
  const replacedBlock = useRef<string | null>(null);

  const closeBlockComments = useCallback(() => {
    void setDrawerQuery(
      {comments: null, commentsBlock: null, comment: null},
      {history: 'replace'}
    );
  }, [setDrawerQuery]);

  const showDrawer = useCallback(() => {
    openDrawer(() => <BlockCommentsDrawer investigationId={investigationId} />, {
      ariaLabel: t('Block comments'),
      drawerKey: 'investigation-block-comments-drawer',
      drawerWidth: '25%',
      mode: 'passive',
      onClose: closeBlockComments,
      shouldCloseOnLocationChange: location =>
        location.pathname !== pathname || location.query.comments !== 'open',
    });
  }, [closeBlockComments, investigationId, openDrawer, pathname]);

  const openBlockComments = useCallback(
    (blockId: string, commentId?: string) => {
      if (replacedBlock.current === blockId) {
        replacedBlock.current = null;
        showDrawer();
      }
      void setDrawerQuery(
        {comments: 'open', commentsBlock: blockId, comment: commentId ?? null},
        {history: 'push'}
      );
    },
    [setDrawerQuery, showDrawer]
  );

  useOnClickOutside(panelRef, event => {
    const target = event.target;
    if (
      !isDrawerOpen ||
      !(target instanceof Element) ||
      target.closest('[data-overlay], [data-block-comments-trigger]') ||
      document.getElementById('modal-portal')?.contains(target)
    ) {
      return;
    }
    closeBlockComments();
  });

  useEffect(() => {
    if (commentsBlock) {
      document
        .getElementById(getBlockElementId(commentsBlock))
        ?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
    }
  }, [commentsBlock]);

  const wasDrawerOpen = useRef(false);
  useEffect(() => {
    const wasOpen = wasDrawerOpen.current;
    wasDrawerOpen.current = isDrawerOpen;
    if (!isOpenInUrl) {
      replacedBlock.current = null;
      return;
    }
    if (isDrawerOpen) {
      return;
    }
    if (isAnyDrawerOpen && wasOpen) {
      replacedBlock.current = commentsBlock;
      return;
    }
    if (replacedBlock.current === commentsBlock) {
      if (!isAnyDrawerOpen) {
        replacedBlock.current = null;
        closeBlockComments();
      }
      return;
    }
    showDrawer();
  }, [
    closeBlockComments,
    commentsBlock,
    isAnyDrawerOpen,
    isDrawerOpen,
    isOpenInUrl,
    showDrawer,
  ]);

  return {openBlockComments};
}
